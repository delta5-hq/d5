import { useAuthContext } from '@entities/auth'
import { Button } from '@shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu'
import { UserIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const UserSettingsButton = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/')
  }
  return (
    <DropdownMenu onOpenChange={() => setIsOpen(prev => !prev)} open={isOpen}>
      <DropdownMenuTrigger asChild data-type="user-settings">
        <Button variant="outline">
          <UserIcon />
          {isOpen ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="flex flex-row justify-between items-center">
          <DropdownMenuLabel>Signed In</DropdownMenuLabel>
          <p className="color px-2 text-xs text-gray-400">{user?.name}</p>
        </div>
        <DropdownMenuItem>Account Settings</DropdownMenuItem>
        <DropdownMenuItem datatype="logout" onClick={onLogout}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserSettingsButton
