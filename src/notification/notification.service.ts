import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async notify(
    patientId: string,
    appointmentId: string,
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      
      const exists = await this.notificationRepo.findOne({
        where: { patientId, appointmentId, type },
      });
      if (exists) return;

      const notification = this.notificationRepo.create({
        patientId,
        appointmentId,
        type,
        title,
        message,
      });
      await this.notificationRepo.save(notification);
    } catch (err) {
      
      this.logger.error(`Failed to create notification for appointment ${appointmentId}: ${err}`);
    }
  }

  async getMyNotifications(patientId: string) {
    const notifications = await this.notificationRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });

    return {
      total: notifications.length,
      unread: notifications.filter((n) => !n.isRead).length,
      notifications,
    };
  }

  async markAsRead(patientId: string, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, patientId },
    });

    if (!notification) {
      return { message: 'Notification not found' };
    }

    notification.isRead = true;
    await this.notificationRepo.save(notification);
    return { message: 'Notification marked as read' };
  }


  async markAllAsRead(patientId: string) {
    await this.notificationRepo.update(
      { patientId, isRead: false },
      { isRead: true },
    );
    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(patientId: string, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, patientId },
    });

    if (!notification) {
      return { message: 'Notification not found' };
    }

    await this.notificationRepo.remove(notification);
    return { message: 'Notification deleted successfully' };
  }
}
