"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, MessageCircle } from "lucide-react"
import { ChatUser, chatService } from "@/lib/chat-service"

interface UserListProps {
  onSelectUser: (userId: string) => void
  selectedUserId?: string
}

export function UserList({ onSelectUser, selectedUserId }: UserListProps) {
  const [users, setUsers] = useState<ChatUser[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    // Load initial users
    setUsers(chatService.getUsers())

    // Subscribe to user updates
    const unsubscribe = chatService.onUsersUpdate((updatedUsers) => {
      setUsers(updatedUsers.filter(u => u.id !== chatService['currentUser']?.id))
    })

    return () => unsubscribe()
  }, [])

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: ChatUser['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'away':
        return 'bg-yellow-500'
      case 'busy':
        return 'bg-red-500'
      case 'offline':
        return 'bg-gray-400'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = (status: ChatUser['status']) => {
    switch (status) {
      case 'online':
        return 'Online'
      case 'away':
        return 'Away'
      case 'busy':
        return 'Busy'
      case 'offline':
        return 'Offline'
      default:
        return 'Unknown'
    }
  }

  return (
    <Card className="h-full">
      <CardContent className="p-4 space-y-4 h-full flex flex-col">
        <div>
          <h3 className="font-semibold text-lg mb-3">Team Members</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {searchQuery ? "No users found" : "No team members online"}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSelectUser(user.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    selectedUserId === user.id ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar with status indicator */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${getStatusColor(user.status)}`}
                        title={getStatusText(user.status)}
                      />
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{user.name}</span>
                        <MessageCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {user.role}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {getStatusText(user.status)}
                        </span>
                      </div>
                      {user.statusMessage && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {user.statusMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          {filteredUsers.filter(u => u.status === 'online').length} online · {filteredUsers.length} total
        </div>
      </CardContent>
    </Card>
  )
}
