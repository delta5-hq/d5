import { motion, useReducedMotion } from 'motion/react'
import {
  Bot,
  Braces,
  ClipboardList,
  Download,
  FileText,
  GitBranch,
  Globe2,
  ListChecks,
  MessageCircle,
  Repeat2,
  Search,
  Sparkles,
  WandSparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { getCommandRole, type CommandRole } from '@shared/constants/command-roles'
import { BUILTIN_COMMANDS } from '@shared/lib/builtin-command-aliases'
import { extractQueryTypeFromCommand, type DynamicAlias } from '@shared/lib/command-querytype-mapper'
import { cn } from '@shared/lib/utils'

const TITLE_CHIP_LIMIT = 20

const COMMAND_BY_ALIAS: Map<string, (typeof BUILTIN_COMMANDS)[number]> = new Map(
  BUILTIN_COMMANDS.map(command => [command.alias, command]),
)

const ROLE_ICON: Record<CommandRole, LucideIcon> = {
  llm: Bot,
  search: Search,
  transform: WandSparkles,
  control: GitBranch,
  utility: Wrench,
}

type MotionLucideIcon = ReturnType<typeof motion.create<typeof Bot>>

const MOTION_ICON_BY_COMPONENT = new WeakMap<LucideIcon, MotionLucideIcon>()

function getMotionIcon(Icon: LucideIcon) {
  const cached = MOTION_ICON_BY_COMPONENT.get(Icon)
  if (cached) return cached
  const MotionIcon = motion.create(Icon) as MotionLucideIcon
  MOTION_ICON_BY_COMPONENT.set(Icon, MotionIcon)
  return MotionIcon
}

function getCommandToken(command: string): string {
  return command.trim().split(/\s+/)[0] ?? ''
}

function getCommandIcon(command: string, role: CommandRole | undefined): LucideIcon {
  const token = getCommandToken(command)
  if (token === '/steps') return ListChecks
  if (token === '/foreach') return Repeat2
  if (token === '/chat' || token === '/chatgpt') return MessageCircle
  if (token === '/web') return Globe2
  if (token === '/download') return Download
  if (token === '/mcp') return Braces
  if (token === '/instruct' || token === '/reason') return Sparkles
  return role ? ROLE_ICON[role] : Wrench
}

function getCommandChipClass(role: CommandRole | undefined, assigned: boolean): string {
  if (!assigned)
    return 'border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground ring-muted-foreground/10'
  if (role === 'control') return 'border-accent/60 bg-accent/15 text-accent ring-accent/20'
  if (role === 'search') return 'border-secondary/60 bg-secondary/10 text-secondary ring-secondary/20'
  if (role === 'transform') return 'border-primary/50 bg-primary/10 text-primary ring-primary/20'
  if (role === 'llm') return 'border-primary/45 bg-primary/10 text-primary ring-primary/20'
  return 'border-muted-foreground/35 bg-muted/55 text-muted-foreground ring-muted-foreground/15'
}

export function truncateTitleForChip(title: string): string {
  return title.length > TITLE_CHIP_LIMIT ? title.slice(0, TITLE_CHIP_LIMIT) : title
}

export function getCommandChip(command: string | undefined, aliases: DynamicAlias[]) {
  const value = command?.trim()
  if (!value) {
    return {
      label: 'Not assigned',
      Icon: ClipboardList,
      testId: 'node-chip-commandless',
      className: getCommandChipClass(undefined, false),
    }
  }

  const token = getCommandToken(value)
  const queryType = COMMAND_BY_ALIAS.get(token)?.queryType ?? extractQueryTypeFromCommand(value, aliases)
  const role = getCommandRole(queryType)
  return {
    label: token || '/',
    Icon: getCommandIcon(value, role),
    testId: token === '/foreach' ? 'node-chip-foreach' : token === '/steps' ? 'node-chip-steps' : 'node-chip-command',
    className: getCommandChipClass(role, true),
  }
}

interface MotionChipIconProps {
  Icon: LucideIcon
  className?: string
}

export const MotionChipIcon = ({ Icon, className }: MotionChipIconProps) => {
  const reduceMotion = useReducedMotion()
  const MotionIcon = getMotionIcon(Icon)

  return (
    <MotionIcon
      aria-hidden="true"
      className={cn('h-3.5 w-3.5 shrink-0', className)}
      data-motion-reduced={reduceMotion || undefined}
      initial={false}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
      whileHover={reduceMotion ? undefined : { scale: 1.18, rotate: 4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.9 }}
    />
  )
}

interface CommandChipProps {
  command: string | undefined
  aliases: DynamicAlias[]
}

export const CommandChip = ({ command, aliases }: CommandChipProps) => {
  const chip = getCommandChip(command, aliases)
  return (
    <span
      className={cn(
        'workflow-tree-command-chip inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2.5 shadow-none ring-1 ring-inset',
        'font-mono text-xs font-bold leading-none tracking-[0.06em]',
        'transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-within:ring-ring active:translate-y-0',
        chip.className,
      )}
      data-chip-kind="command"
      data-testid={chip.testId}
    >
      <MotionChipIcon Icon={chip.Icon} />
      <span className="truncate">{chip.label}</span>
    </span>
  )
}

export const ScriptTitleIcon = () => <MotionChipIcon Icon={FileText} className="text-primary/30" />
