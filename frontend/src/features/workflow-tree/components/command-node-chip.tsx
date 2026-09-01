import type { CSSProperties } from 'react'
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
import { getColorForRole } from '@shared/ui/genie/role-colors'
import { BUILTIN_COMMANDS } from '@shared/lib/builtin-command-aliases'
import { extractQueryTypeFromCommand, type DynamicAlias } from '@shared/lib/command-querytype-mapper'
import { matchesAnyCommandWithOrder } from '@shared/lib/command-validation/command-matcher'
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

const COMMANDLESS_CHIP_CLASS =
  'border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground ring-muted-foreground/10'

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

export function truncateTitleForChip(title: string): string {
  return title.length > TITLE_CHIP_LIMIT ? title.slice(0, TITLE_CHIP_LIMIT) : title
}

export interface CommandChipDescriptor {
  label: string
  Icon: LucideIcon
  testId: string
  color?: string
}

export function getCommandChip(command: string | undefined, aliases: DynamicAlias[]): CommandChipDescriptor {
  const value = command?.trim()
  // Non-command text (unparsable command / text duplicated from the title) is not a
  // command pill: render the commandless clipboard chip instead.
  if (!value || !matchesAnyCommandWithOrder(value, aliases)) {
    return {
      label: 'Not assigned',
      Icon: ClipboardList,
      testId: 'node-chip-commandless',
    }
  }

  const token = getCommandToken(value)
  const queryType = COMMAND_BY_ALIAS.get(token)?.queryType ?? extractQueryTypeFromCommand(value, aliases)
  const role = getCommandRole(queryType)
  return {
    label: token || '/',
    Icon: getCommandIcon(value, role),
    testId: token === '/foreach' ? 'node-chip-foreach' : token === '/steps' ? 'node-chip-steps' : 'node-chip-command',
    color: getColorForRole(role),
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
  const assigned = chip.color !== undefined

  return (
    <span
      className={cn(
        'workflow-tree-command-chip inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2.5 shadow-none ring-1 ring-inset',
        'font-mono text-xs font-bold leading-none tracking-[0.06em]',
        'transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-within:ring-ring active:translate-y-0',
        assigned ? 'workflow-tree-command-chip--role' : COMMANDLESS_CHIP_CLASS,
      )}
      data-chip-kind="command"
      data-testid={chip.testId}
      style={assigned ? ({ '--chip-role-color': chip.color } as CSSProperties) : undefined}
    >
      <MotionChipIcon Icon={chip.Icon} />
      <span className="truncate">{chip.label}</span>
    </span>
  )
}

export const ScriptTitleIcon = () => <MotionChipIcon Icon={FileText} className="text-primary/30" />
