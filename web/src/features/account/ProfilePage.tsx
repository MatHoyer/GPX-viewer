import { ImageUp, Trash2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SidebarTrigger } from '@/components/ui/sidebar'
import type { User } from '@/features/auth/api'
import { useMe } from '@/features/auth/useAuth'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'

import { AVATAR_TYPES, MAX_AVATAR_BYTES, MAX_NAME_LENGTH } from './api'
import { useDeleteAvatar, useUpdateAccount, useUploadAvatar } from './useAccount'
import { UserAvatar } from './UserAvatar'

export function ProfilePage() {
  const me = useMe()

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2 sm:px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Profile</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        {me.data && (
          <div className="mx-auto max-w-2xl space-y-4 p-4">
            <AvatarCard user={me.data} />
            {/* Keyed so the form resets if the saved name changes elsewhere. */}
            <DetailsCard key={me.data.name} user={me.data} />
          </div>
        )}
      </main>
    </div>
  )
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

function AvatarCard({ user }: { user: User }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadAvatar()
  const remove = useDeleteAvatar()
  const busy = upload.isPending || remove.isPending

  function onFile(file: File | undefined) {
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) return toast.error('Use a PNG, JPEG, WebP or GIF image')
    if (file.size > MAX_AVATAR_BYTES) return toast.error(`Image must be at most ${MAX_AVATAR_BYTES >> 20} MB`)
    upload.mutate(file, {
      onSuccess: () => toast.success('Profile picture updated'),
      onError: (err) => toast.error(errorMessage(err, 'Could not upload picture')),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile picture</CardTitle>
        <CardDescription>
          PNG, JPEG, WebP or GIF, up to {MAX_AVATAR_BYTES >> 20} MB. Without one, you get a blobatar generated for your
          account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <UserAvatar user={user} className="size-20" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            <ImageUp />
            {upload.isPending ? 'Uploading…' : 'Upload picture'}
          </Button>
          {user.avatarUrl && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => toast.success('Profile picture removed'),
                  onError: (err) => toast.error(errorMessage(err, 'Could not remove picture')),
                })
              }
            >
              <Trash2 />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_TYPES.join(',')}
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </CardContent>
    </Card>
  )
}

function DetailsCard({ user }: { user: User }) {
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
        onSuccess: () => toast.success('Profile saved'),
        onError: (err) => toast.error(errorMessage(err, 'Could not save profile')),
      },
    )
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="contents">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={user.email.split('@')[0]}
              maxLength={MAX_NAME_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user.email} disabled />
          </div>
          <p className="text-muted-foreground text-sm">Member since {formatDate(user.createdAt)}</p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
