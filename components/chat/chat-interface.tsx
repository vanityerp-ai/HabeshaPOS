"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth-provider"
import { chatService, type ChatChannel, type ChatMessage, type ChatNotification } from "@/lib/chat-service"
import { ProductRequestDialog } from "./product-request-dialog"
import { HelpRequestDialog } from "./help-request-dialog"
import { UserList } from "./user-list"
import {
  MessageCircle,
  Send,
  Minimize2,
  Maximize2,
  Users,
  Bell,
  Search,
  Package,
  HelpCircle,
  Hash,
  X,
  Plus,
  MoreHorizontal
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInterfaceProps {
  className?: string;
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const { user } = useAuth()
  const [isMinimized, setIsMinimized] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string>('general')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [notifications, setNotifications] = useState<ChatNotification[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState<'channels' | 'users'>('channels')
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize chat service with current user
  useEffect(() => {
    if (user) {
      chatService.setCurrentUser({
        id: user.id,
        name: user.name,
        role: user.role,
        status: 'online',
        lastSeen: new Date(),
        currentLocationId: user.locations[0] !== 'all' ? user.locations[0] : undefined
      })
    }
  }, [user])

  // Subscribe to chat updates
  useEffect(() => {
    const unsubscribeChannels = chatService.onChannelsUpdate(setChannels)
    const unsubscribeNotifications = chatService.onNotificationsUpdate(setNotifications)

    const unsubscribeMessages = chatService.onMessage((message) => {
      if (message.channelId === activeChannelId) {
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const messageExists = prev.some(m => m.id === message.id)
          if (messageExists) {
            return prev
          }
          return [...prev, message]
        })
      }
    })

    // Load initial data
    setChannels(chatService.getChannels())
    setNotifications(chatService.getNotifications())

    return () => {
      unsubscribeChannels()
      unsubscribeNotifications()
      unsubscribeMessages()
    }
  }, [activeChannelId])

  // Load messages when channel changes
  useEffect(() => {
    setMessages(chatService.getMessages(activeChannelId))
  }, [activeChannelId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = () => {
    if (!newMessage.trim() || !user) return

    const messageType = activeChannelId === 'product-requests' ? 'product_request' :
                       activeChannelId === 'help-desk' ? 'help_request' : 'text'

    chatService.sendMessage(activeChannelId, newMessage.trim(), messageType)
    setNewMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId)
    const dmChannel = chatService.getOrCreateDMChannel(userId)
    setActiveChannelId(dmChannel.id)
    setActiveView('channels')
  }

  const getChannelIcon = (channel: ChatChannel) => {
    switch (channel.type) {
      case 'product_requests':
        return <Package className="h-4 w-4" />
      case 'help_desk':
        return <HelpCircle className="h-4 w-4" />
      case 'direct_message':
        return <MessageCircle className="h-4 w-4" />
      default:
        return <Hash className="h-4 w-4" />
    }
  }

  const getMessageTypeColor = (messageType: ChatMessage['messageType']) => {
    switch (messageType) {
      case 'product_request':
        return 'bg-blue-100 border-blue-200 text-blue-800'
      case 'help_request':
        return 'bg-yellow-100 border-yellow-200 text-yellow-800'
      case 'system':
        return 'bg-gray-100 border-gray-200 text-gray-800'
      default:
        return 'bg-white border-gray-200'
    }
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date)
  }

  const unreadCount = chatService.getUnreadNotificationCount()

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 shadow-lg"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
    )
  }

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 shadow-xl border-2",
      isMinimized ? "w-80 h-16" : "w-[800px] h-[600px]",
      className
    )}>
      <CardHeader className="pb-2 px-4 py-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Team Chat
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 px-2 text-xs">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant={activeView === 'channels' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setActiveView('channels')}
          >
            <Hash className="h-3 w-3 mr-1" />
            Channels
          </Button>
          <Button
            variant={activeView === 'users' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setActiveView('users')}
          >
            <Users className="h-3 w-3 mr-1" />
            Team
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 h-[calc(100%-4rem)] flex flex-col">
          {activeView === 'users' ? (
            <div className="flex-1 p-4">
              <UserList onSelectUser={handleUserSelect} selectedUserId={selectedUserId} />
            </div>
          ) : (
            <Tabs value={activeChannelId} onValueChange={setActiveChannelId} className="flex-1 flex flex-col">
              <div className="px-4 pb-2">
                <ScrollArea className="w-full">
                  <TabsList className="w-full h-8 inline-flex">
                    {channels.map((channel) => (
                      <TabsTrigger
                        key={channel.id}
                        value={channel.id}
                        className="text-xs px-3 flex items-center gap-1 whitespace-nowrap"
                      >
                        {getChannelIcon(channel)}
                        <span className="truncate">{channel.name}</span>
                        {channel.unreadCount > 0 && (
                          <Badge variant="destructive" className="h-4 w-4 p-0 text-xs">
                            {channel.unreadCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </ScrollArea>
              </div>

            {channels.map((channel) => (
              <TabsContent
                key={channel.id}
                value={channel.id}
                className="flex-1 flex flex-col mt-0 px-4"
              >
                {/* Search */}
                <div className="mb-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search messages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-3">
                    {messages
                      .filter(message =>
                        !searchQuery ||
                        message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        message.senderName.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "p-3 rounded-lg border",
                            getMessageTypeColor(message.messageType),
                            message.senderId === user?.id ? "ml-8" : "mr-8"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{message.senderName}</span>
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {message.senderRole}
                              </Badge>
                              {message.messageType !== 'text' && (
                                <Badge variant="secondary" className="text-xs px-1 py-0">
                                  {message.messageType === 'product_request' ? 'Product Request' :
                                   message.messageType === 'help_request' ? 'Help Request' :
                                   message.messageType}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(message.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm">{message.content}</p>

                          {message.metadata?.productName && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                  {message.metadata.productName}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="mt-2 space-y-2">
                  {/* Quick Action Buttons */}
                  {(channel.type === 'product_requests' || channel.type === 'help_desk') && (
                    <div className="flex gap-2">
                      {channel.type === 'product_requests' && (
                        <ProductRequestDialog channelId={channel.id}>
                          <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Request Product
                          </Button>
                        </ProductRequestDialog>
                      )}

                      {channel.type === 'help_desk' && (
                        <HelpRequestDialog channelId={channel.id}>
                          <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <HelpCircle className="h-4 w-4" />
                            Get Help
                          </Button>
                        </HelpRequestDialog>
                      )}
                    </div>
                  )}

                  {/* Text Input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={
                        channel.type === 'product_requests' ? "Type a message or use the Request Product button..." :
                        channel.type === 'help_desk' ? "Type a message or use the Get Help button..." :
                        "Type a message..."
                      }
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1 text-sm"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      size="icon"
                      className="h-9 w-9"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
          )}
        </CardContent>
      )}
    </Card>
  )
}
