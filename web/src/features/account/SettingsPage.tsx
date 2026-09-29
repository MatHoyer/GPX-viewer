import { Download, ExternalLink, Globe, Lock, UsersRound } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, type ComponentType, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, useParams } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import type { User, Visibility } from '@/features/auth/api'
import { useChangePassword, useConfig, useMe, useRequestPasswordReset } from '@/features/auth/useAuth'
import { PageHeader } from '@/features/layout/PageHeader'
import { SessionsCard } from '@/features/sessions/SessionsCard'
import { isLanguage } from '@/i18n'
import { languageOptions } from '@/i18n/languages'
import { ApiError } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { MAX_NAME_LENGTH } from './api'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { settingsSections } from './settingsSections'
import { useUpdateAccount } from './useAccount'
import { useSetLanguage } from './useLanguage'
import { themes } from './themes'
import { UserAvatar } from './UserAvatar'

export function SettingsPage() {
  const { t } = useTranslation()
  const { section = 'profile' } = useParams()
  const me = useMe()
  const current = settingsSections.find((s) => s.value === section)
  if (!current) return <Navigate to="/settings" replace />

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        crumbs={[{ label: t('settings.title'), to: '/settings' }, { label: t(`settings.sections.${current.value}`) }]}
      >
        <SectionNav />
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          {me.data && (
            <div className="mx-auto max-w-2xl space-y-4 p-4">
              <h1 className="sr-only">{t(`settings.sections.${current.value}`)}</h1>
              {current.value === 'profile' && (
                <>
                  {/* Keyed so the form resets if the saved name changes elsewhere. */}
                  <DetailsCard key={me.data.name} user={me.data} />
                  <VisibilityCard user={me.data} />
                </>
              )}
              {current.value === 'security' && (
                <>
                  <PasswordCard user={me.data} />
                  <SessionsCard />
                </>
              )}
              {current.value === 'preferences' && (
                <>
                  <ThemeCard />
                  <LanguageCard />
                </>
              )}
              {current.value === 'account' && (
                <>
                  <ExportCard />
                  <DangerZoneCard user={me.data} />
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

/** Tabs over the content, lined up with it. On phones they share the width and drop their icons to fit. */
function SectionNav() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('settings.title')}>
      <div className="mx-auto flex max-w-2xl px-2 sm:gap-1 sm:px-4">
        {settingsSections.map(({ value, path, icon: Icon }) => (
          <NavLink
            key={value}
            to={path}
            end
            className={({ isActive }) =>
              cn(
                'focus-visible:ring-ring/50 -mb-px flex min-w-0 flex-auto items-center justify-center gap-2 border-b-2 px-1 py-2.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 sm:flex-none sm:px-3',
                isActive
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )
            }
          >
            <Icon className="size-4 max-sm:hidden" />
            <span className="truncate">{t(`settings.sections.${value}`)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function DetailsCard({ user }: { user: User }) {
  const { t } = useTranslation()
  const [name, setName] = useState(user.name)
  const update = useUpdateAccount()
  const trimmed = name.trim()
  const dirty = trimmed !== user.name

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!dirty) return
    update.mutate(
      { name: trimmed },
      {
        onSuccess: () => toast.success(t('settings.profileSaved')),
        onError: (err) => toast.error(errorMessage(err, t('settings.profileSaveFailed'))),
      },
    )
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="contents">
        <CardHeader>
          <CardTitle>{t('settings.profile')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UserAvatar user={user} className="mx-auto size-28" />
          <FloatingInput
            label={t('settings.displayName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={user.email.split('@')[0]}
            maxLength={MAX_NAME_LENGTH}
            description={t('settings.displayNameHint', { name: user.email.split('@')[0] })}
          />
          <FloatingInput label={t('common.email')} value={user.email} disabled />
          <p className="text-muted-foreground text-sm">{t('settings.memberSince', { date: formatDate(user.createdAt) })}</p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PasswordCard({ user }: { user: User }) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const change = useChangePassword()
  const sendReset = useRequestPasswordReset()
  const emailEnabled = useConfig().data?.emailEnabled
  const error = change.error instanceof ApiError ? change.error : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    change.mutate(
      { currentPassword, password },
      {
        onSuccess: () => {
          setCurrentPassword('')
          setPassword('')
          toast.success(t('settings.passwordChanged'), { description: t('settings.passwordChangedDescription') })
        },
      },
    )
  }

  function onForgot() {
    sendReset.mutate(user.email, {
      onSuccess: () => toast.success(t('settings.resetSent', { email: user.email })),
      onError: (err) => toast.error(errorMessage(err, t('settings.resetFailed'))),
    })
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="contents">
        <CardHeader>
          <CardTitle>{t('settings.password')}</CardTitle>
          <CardDescription>{t('settings.passwordHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lets password managers tie the new password to this account. */}
          <input type="email" autoComplete="username" value={user.email} readOnly hidden />
          <FloatingInput
            label={t('settings.currentPassword')}
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            aria-invalid={error?.field === 'currentPassword' || undefined}
          />
          <FloatingInput
            label={t('settings.newPassword')}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error?.field === 'password' || undefined}
            description={t('settings.passwordRule')}
          />
          {change.error && (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage(change.error, t('settings.passwordChangeFailed'))}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-2">
          {emailEnabled !== false ? (
            <Button type="button" variant="link" className="px-0" disabled={sendReset.isPending} onClick={onForgot}>
              {t('settings.forgotCurrent')}
            </Button>
          ) : (
            <span className="text-muted-foreground text-sm">{t('settings.forgotNoEmail')}</span>
          )}
          <Button type="submit" disabled={!currentPassword || !password || change.isPending}>
            {change.isPending ? t('settings.changing') : t('settings.changePassword')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

const visibilityIcons = { private: Lock, friends: UsersRound, public: Globe }

function VisibilityCard({ user }: { user: User }) {
  const { t } = useTranslation()
  const update = useUpdateAccount()
  const visibilityOptions: Option<Visibility>[] = (['private', 'friends', 'public'] as const).map((value) => ({
    value,
    label: t(`settings.${value}`),
    description: t(`settings.${value}Description`),
    icon: visibilityIcons[value],
  }))

  function select(visibility: Visibility) {
    if (visibility === user.visibility || update.isPending) return
    update.mutate(
      { visibility },
      {
        onSuccess: () => toast.success(t('settings.visibilityUpdated')),
        onError: (err) => toast.error(errorMessage(err, t('settings.visibilityFailed'))),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.visibilityTitle')}</CardTitle>
        <CardDescription>{t('settings.visibilityDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <OptionCards
          label={t('settings.visibilityLabel')}
          options={visibilityOptions}
          value={user.visibility}
          onChange={select}
          disabled={update.isPending}
        />
      </CardContent>
      <CardFooter className="justify-end">
        <Button asChild variant="outline">
          <Link to={`/u/${user.id}`}>
            <ExternalLink />
            {t('settings.viewProfile')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function ExportCard() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.export')}</CardTitle>
        <CardDescription>{t('settings.exportDescription')}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <Button asChild variant="outline">
          <a href="/api/hikes/export" download>
            <Download />
            {t('settings.exportButton')}
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

function DangerZoneCard({ user }: { user: User }) {
  const { t } = useTranslation()
  return (
    <Card className="ring-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
        <CardDescription>{t('settings.dangerDescription')}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <DeleteAccountDialog user={user} />
      </CardFooter>
    </Card>
  )
}

function ThemeCard() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const themeOptions: Option<string>[] = themes.map(({ value, icon }) => ({
    value,
    label: t(`theme.${value}`),
    description: t(`theme.${value}Description`),
    icon,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.theme')}</CardTitle>
      </CardHeader>
      <CardContent>
        <OptionCards label={t('settings.theme')} options={themeOptions} value={theme ?? 'system'} onChange={setTheme} />
      </CardContent>
    </Card>
  )
}

function LanguageCard() {
  const { t, i18n } = useTranslation()
  const setLanguage = useSetLanguage()
  const languageCards: Option<string>[] = languageOptions.map(({ value, label, flag: Flag }) => ({
    value,
    label,
    // Named in the current language too, unless that is the same word.
    description: t(`language.${value}`) === label ? '' : t(`language.${value}`),
    icon: ({ className }) => <Flag className={cn(className, 'h-3 w-4.5 rounded-[2px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.2)]')} />,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.language')}</CardTitle>
        <CardDescription>{t('settings.languageDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <OptionCards
          label={t('settings.language')}
          options={languageCards}
          value={i18n.language}
          onChange={(v) => isLanguage(v) && setLanguage(v)}
        />
      </CardContent>
    </Card>
  )
}

type Option<T> = { value: T; label: string; description: string; icon: ComponentType<{ className?: string }> }

/** A radio group of cards, each with an icon, a label and a description. */
function OptionCards<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map(({ value: v, label, description, icon: Icon }) => {
        const checked = value === v
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              'hover:bg-muted/50 focus-visible:ring-ring/50 flex flex-col gap-1 rounded-lg border p-3 text-left outline-none focus-visible:ring-3 disabled:opacity-60',
              checked && 'border-primary bg-primary/5 ring-primary ring-1',
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon className="size-4" />
              {label}
            </span>
            {description && <span className="text-muted-foreground text-xs">{description}</span>}
          </button>
        )
      })}
    </div>
  )
}
