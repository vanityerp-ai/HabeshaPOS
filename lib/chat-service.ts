"use client"

import { useAuth } from "@/lib/auth-provider"

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentLocationId?: string;
  statusMessage?: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: 'general' | 'help_desk' | 'product_requests' | 'location_specific' | 'private' | 'direct_message';
  locationId?: string;
  isPrivate: boolean;
  memberCount: number;
  unreadCount: number;
  lastMessage?: ChatMessage;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // For DM channels
  participants?: string[]; // User IDs
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  messageType: 'text' | 'product_request' | 'help_request' | 'system' | 'file';
  content: string;
  metadata?: {
    productId?: string;
    productName?: string;
    requestType?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    attachments?: Array<{
      name: string;
      url: string;
      type: string;
      size: number;
    }>;
  };
  replyToId?: string;
  reactions: Array<{
    emoji: string;
    users: string[];
    count: number;
  }>;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
}

export interface ChatNotification {
  id: string;
  userId: string;
  messageId: string;
  channelId: string;
  channelName: string;
  senderName: string;
  type: 'mention' | 'direct_message' | 'channel_message' | 'system';
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

/**
 * Chat service for managing real-time communication
 */
export class ChatService {
  private channels: ChatChannel[] = [];
  private messages: Map<string, ChatMessage[]> = new Map();
  private notifications: ChatNotification[] = [];
  private users: ChatUser[] = [];
  private currentUser: ChatUser | null = null;
  
  // Event listeners
  private messageListeners: Array<(message: ChatMessage) => void> = [];
  private channelListeners: Array<(channels: ChatChannel[]) => void> = [];
  private notificationListeners: Array<(notifications: ChatNotification[]) => void> = [];
  private userListeners: Array<(users: ChatUser[]) => void> = [];

  constructor() {
    this.loadFromStorage();
    this.initializeDefaultChannels();
    this.startPresenceUpdates();
  }

  /**
   * Load data from localStorage
   */
  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      try {
        const storedChannels = localStorage.getItem('vanity_chat_channels');
        if (storedChannels) {
          this.channels = JSON.parse(storedChannels).map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            lastMessage: c.lastMessage ? {
              ...c.lastMessage,
              createdAt: new Date(c.lastMessage.createdAt)
            } : undefined
          }));
        }

        const storedMessages = localStorage.getItem('vanity_chat_messages');
        if (storedMessages) {
          const messagesData = JSON.parse(storedMessages);
          Object.entries(messagesData).forEach(([channelId, messages]: [string, any]) => {
            this.messages.set(channelId, messages.map((m: any) => ({
              ...m,
              createdAt: new Date(m.createdAt),
              editedAt: m.editedAt ? new Date(m.editedAt) : undefined
            })));
          });
        }

        const storedNotifications = localStorage.getItem('vanity_chat_notifications');
        if (storedNotifications) {
          this.notifications = JSON.parse(storedNotifications).map((n: any) => ({
            ...n,
            createdAt: new Date(n.createdAt),
            readAt: n.readAt ? new Date(n.readAt) : undefined
          }));
        }

        const storedUsers = localStorage.getItem('vanity_chat_users');
        if (storedUsers) {
          this.users = JSON.parse(storedUsers).map((u: any) => ({
            ...u,
            lastSeen: new Date(u.lastSeen)
          }));
        }
      } catch (error) {
        console.error('Failed to load chat data from storage:', error);
      }
    }
  }

  /**
   * Save data to localStorage
   */
  private saveToStorage() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vanity_chat_channels', JSON.stringify(this.channels));
        
        const messagesData: Record<string, ChatMessage[]> = {};
        this.messages.forEach((messages, channelId) => {
          messagesData[channelId] = messages;
        });
        localStorage.setItem('vanity_chat_messages', JSON.stringify(messagesData));
        
        localStorage.setItem('vanity_chat_notifications', JSON.stringify(this.notifications));
        localStorage.setItem('vanity_chat_users', JSON.stringify(this.users));
      } catch (error) {
        console.error('Failed to save chat data to storage:', error);
      }
    }
  }

  /**
   * Initialize default channels
   */
  private initializeDefaultChannels() {
    if (this.channels.length === 0) {
      const defaultChannels: ChatChannel[] = [
        {
          id: 'general',
          name: 'General',
          description: 'General workplace communication',
          type: 'general',
          isPrivate: false,
          memberCount: 0,
          unreadCount: 0,
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'help-desk',
          name: 'Help Desk',
          description: 'Ask questions about procedures and policies',
          type: 'help_desk',
          isPrivate: false,
          memberCount: 0,
          unreadCount: 0,
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'product-requests',
          name: 'Product Requests',
          description: 'Request inventory items and check availability',
          type: 'product_requests',
          isPrivate: false,
          memberCount: 0,
          unreadCount: 0,
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      this.channels = defaultChannels;
      this.saveToStorage();
    }
  }

  /**
   * Start presence updates
   */
  private startPresenceUpdates() {
    // Update user presence every 30 seconds
    setInterval(() => {
      if (this.currentUser) {
        this.updateUserPresence(this.currentUser.id, 'online');
      }
    }, 30000);
  }

  /**
   * Set current user
   */
  setCurrentUser(user: ChatUser) {
    this.currentUser = user;
    this.updateUserPresence(user.id, 'online');
    
    // Add user to users list if not exists
    const existingUserIndex = this.users.findIndex(u => u.id === user.id);
    if (existingUserIndex >= 0) {
      this.users[existingUserIndex] = user;
    } else {
      this.users.push(user);
    }
    
    this.saveToStorage();
    this.notifyUserListeners();
  }

  /**
   * Update user presence
   */
  updateUserPresence(userId: string, status: ChatUser['status'], statusMessage?: string) {
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex >= 0) {
      this.users[userIndex].status = status;
      this.users[userIndex].lastSeen = new Date();
      if (statusMessage !== undefined) {
        this.users[userIndex].statusMessage = statusMessage;
      }
      this.saveToStorage();
      this.notifyUserListeners();
    }
  }

  /**
   * Get all channels accessible to current user
   */
  getChannels(): ChatChannel[] {
    if (!this.currentUser) return [];
    
    return this.channels.filter(channel => {
      // Return public channels or DM channels where user is a participant
      if (channel.type === 'direct_message') {
        return channel.participants?.includes(this.currentUser!.id);
      }
      return !channel.isPrivate;
    });
  }

  /**
   * Get all users (for user list)
   */
  getUsers(): ChatUser[] {
    return this.users.filter(u => u.id !== this.currentUser?.id);
  }

  /**
   * Get or create a DM channel between current user and another user
   */
  getOrCreateDMChannel(otherUserId: string): ChatChannel {
    if (!this.currentUser) {
      throw new Error('No current user set');
    }

    // Find existing DM channel between these users
    const existingDM = this.channels.find(channel => 
      channel.type === 'direct_message' &&
      channel.participants &&
      channel.participants.includes(this.currentUser!.id) &&
      channel.participants.includes(otherUserId)
    );

    if (existingDM) {
      return existingDM;
    }

    // Create new DM channel
    const otherUser = this.users.find(u => u.id === otherUserId);
    if (!otherUser) {
      throw new Error('User not found');
    }

    const dmChannel: ChatChannel = {
      id: `dm-${this.currentUser.id}-${otherUserId}`,
      name: otherUser.name,
      type: 'direct_message',
      isPrivate: true,
      memberCount: 2,
      unreadCount: 0,
      createdBy: this.currentUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [this.currentUser.id, otherUserId]
    };

    this.channels.push(dmChannel);
    this.saveToStorage();
    this.notifyChannelListeners();

    return dmChannel;
  }

  /**
   * Get messages for a channel
   */
  getMessages(channelId: string): ChatMessage[] {
    return this.messages.get(channelId) || [];
  }

  /**
   * Send a message
   */
  sendMessage(
    channelId: string,
    content: string,
    messageType: ChatMessage['messageType'] = 'text',
    metadata?: ChatMessage['metadata'],
    replyToId?: string
  ): ChatMessage {
    if (!this.currentUser) {
      throw new Error('No current user set');
    }

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      channelId,
      senderId: this.currentUser.id,
      senderName: this.currentUser.name,
      senderRole: this.currentUser.role,
      messageType,
      content,
      metadata,
      replyToId,
      reactions: [],
      isEdited: false,
      createdAt: new Date()
    };

    // Add message to channel
    const channelMessages = this.messages.get(channelId) || [];
    channelMessages.push(message);
    this.messages.set(channelId, channelMessages);

    // Update channel's last message
    const channelIndex = this.channels.findIndex(c => c.id === channelId);
    if (channelIndex >= 0) {
      this.channels[channelIndex].lastMessage = message;
      this.channels[channelIndex].updatedAt = new Date();
    }

    this.saveToStorage();
    this.notifyMessageListeners(message);
    this.notifyChannelListeners();

    // Create notifications for other users
    this.createNotifications(message);

    return message;
  }

  /**
   * Create notifications for a message
   */
  private createNotifications(message: ChatMessage) {
    const channel = this.channels.find(c => c.id === message.channelId);
    
    // For DM channels, notify only the other participant
    if (channel && channel.type === 'direct_message' && channel.participants) {
      const otherUserId = channel.participants.find(id => id !== message.senderId);
      if (otherUserId) {
        const notification: ChatNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: otherUserId,
          messageId: message.id,
          channelId: message.channelId,
          channelName: message.senderName,
          senderName: message.senderName,
          type: 'direct_message',
          content: message.content,
          isRead: false,
          createdAt: new Date()
        };
        this.notifications.push(notification);
      }
    } else {
      // For regular channels, notify all users except sender
      this.users
        .filter(user => user.id !== message.senderId)
        .forEach(user => {
          const notification: ChatNotification = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: user.id,
            messageId: message.id,
            channelId: message.channelId,
            channelName: channel?.name || 'Unknown',
            senderName: message.senderName,
            type: 'channel_message',
            content: message.content,
            isRead: false,
            createdAt: new Date()
          };

          this.notifications.push(notification);
        });
    }

    this.saveToStorage();
    this.notifyNotificationListeners();
  }

  /**
   * Get notifications for current user
   */
  getNotifications(): ChatNotification[] {
    if (!this.currentUser) return [];
    
    return this.notifications
      .filter(n => n.userId === this.currentUser!.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      notification.readAt = new Date();
      this.saveToStorage();
      this.notifyNotificationListeners();
    }
  }

  /**
   * Get unread notification count
   */
  getUnreadNotificationCount(): number {
    if (!this.currentUser) return 0;
    
    return this.notifications.filter(n => 
      n.userId === this.currentUser!.id && !n.isRead
    ).length;
  }

  /**
   * Event listener management
   */
  onMessage(listener: (message: ChatMessage) => void) {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }

  onChannelsUpdate(listener: (channels: ChatChannel[]) => void) {
    this.channelListeners.push(listener);
    return () => {
      this.channelListeners = this.channelListeners.filter(l => l !== listener);
    };
  }

  onNotificationsUpdate(listener: (notifications: ChatNotification[]) => void) {
    this.notificationListeners.push(listener);
    return () => {
      this.notificationListeners = this.notificationListeners.filter(l => l !== listener);
    };
  }

  onUsersUpdate(listener: (users: ChatUser[]) => void) {
    this.userListeners.push(listener);
    return () => {
      this.userListeners = this.userListeners.filter(l => l !== listener);
    };
  }

  private notifyMessageListeners(message: ChatMessage) {
    this.messageListeners.forEach(listener => listener(message));
  }

  private notifyChannelListeners() {
    this.channelListeners.forEach(listener => listener(this.getChannels()));
  }

  private notifyNotificationListeners() {
    this.notificationListeners.forEach(listener => listener(this.getNotifications()));
  }

  private notifyUserListeners() {
    this.userListeners.forEach(listener => listener(this.users));
  }
}

// Export singleton instance
export const chatService = new ChatService();
