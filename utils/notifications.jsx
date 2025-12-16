import { base44 } from '@/api/base44Client';
import { shouldSendEmail } from './notificationHelpers';
import { getAppBaseUrl } from './appConfig';

const Notification = base44.entities.Notification;
const User = base44.entities.User;

const APP_BASE_URL = getAppBaseUrl();

/**
 * Create an in-app notification for a user with optional email.
 *
 * @param {Object} params
 * @param {string} params.userId - The user ID to notify
 * @param {string} params.type - Notification type (e.g. 'leave_submitted')
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} [params.category] - NotificationCategory for preference checking
 * @param {string} [params.link] - Deep link in the app (e.g. '/LeaveApprovals')
 * @param {Object} [params.metadata] - Optional JSON metadata (currently unused in create)
 * @param {boolean} [params.sendEmail=false] - Whether to send email (if user prefs allow)
 * @param {string} [params.relatedEmployeeId] - Related employee ID
 * @param {string} [params.relatedRequestId] - Related leave request ID
 * @returns {Promise<Object|null>} The created Notification object, or null if creation failed
 */
export async function sendNotification({
  userId,
  type,
  title,
  message,
  category,
  link,
  metadata,           // kept for future use
  sendEmail = false,
  targetEmail = null, // Optional direct email override (to avoid User entity permission issues)
  relatedEmployeeId,
  relatedRequestId,
}) {
  // Always create in-app notification for now (prefs control email only)
  let notification;
  try {
    notification = await Notification.create({
      user_id: userId,
      type,
      title,
      message,
      link: link || null,
      is_read: false,
      created_at: new Date().toISOString(),
      related_employee_id: relatedEmployeeId || null,
      related_request_id: relatedRequestId || null,
      // If your Notification entity has metadata, you can uncomment this:
      // metadata: metadata || null,
    });
  } catch (err) {
    console.error('Error creating notification:', err);
    // If we can't even create an in-app notification, bail early
    return null;
  }

  // Send email if requested and preferences allow
  if (sendEmail && category) {
    try {
      const allowEmail = await shouldSendEmail(userId, category);
      if (allowEmail) {
        let emailToSendTo = targetEmail;

        // If no target email provided, try to fetch from User entity
        if (!emailToSendTo) {
          try {
            // Note: Regular users cannot fetch other users, so this may fail if notifying someone else
            let user;
            try {
              user = await User.get(userId);
            } catch {
              const users = await User.filter({ id: userId });
              user = users?.[0];
            }
            if (user) {
              emailToSendTo = user.email;
            }
          } catch (err) {
            console.warn('Could not fetch user for email notification (likely permission issue)', err);
          }
        }

        if (emailToSendTo) {
          let emailBody = message;
          if (link) {
            emailBody += `\n\nView in FoundersCreW: ${APP_BASE_URL}${link}`;
          }

          await base44.integrations.Core.SendEmail({
            to: emailToSendTo,
            subject: title,
            body: emailBody,
          });

          console.log(`Email sent to ${emailToSendTo} for notification: ${title}`);
        } else {
          console.warn(`Skipping email for notification "${title}": No email address found`);
        }
      }
    } catch (emailError) {
      // Don't fail the in-app notification if email fails
      console.error('Error sending notification email:', emailError);
    }
  }

  return notification;
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId) {
  return await Notification.update(notificationId, { is_read: true });
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllAsRead(userId) {
  // Try filtering by user_id (Auth ID) first
  let notifications = await Notification.filter({
    user_id: userId,
    is_read: false,
  });

  // Fallback: if no notifications found by user_id, maybe they were created with related_employee_id
  if (notifications.length === 0) {
    notifications = await Notification.filter({
      related_employee_id: userId, // userId might be employeeId in legacy calls
      is_read: false,
    });
  }

  await Promise.all(
    notifications.map((n) =>
      Notification.update(n.id, { is_read: true })
    )
  );
}