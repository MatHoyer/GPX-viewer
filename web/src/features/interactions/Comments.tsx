import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import type { Hike } from '@/features/hikes/api'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'

import { MAX_COMMENT_LENGTH, useComments, useDeleteComment, usePostComment } from './api'

/** A hike's comments; signed-in viewers can add theirs, and remove them or, as the owner, any. */
export function Comments({ hike, viewerId }: { hike: Hike; viewerId: string | undefined }) {
  const comments = useComments(hike.id)
  const post = usePostComment(hike.id)
  const remove = useDeleteComment(hike.id)
  const [draft, setDraft] = useState('')
  const list = comments.data ?? []

  if (list.length === 0 && viewerId === undefined) return null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    post.mutate(draft, {
      onSuccess: () => setDraft(''),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not post comment'),
    })
  }

  return (
    <section id="comments" className="bg-card space-y-3 rounded-xl border p-4">
      <h2 className="text-sm font-medium">Comments{list.length > 0 && ` (${list.length})`}</h2>
      {list.length > 0 && (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              {c.author && (
                <Link to={`/u/${c.author.id}`} className="shrink-0">
                  <UserAvatar user={c.author} className="size-7" />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium">
                    {c.author?.id === viewerId ? 'You' : c.author ? displayName(c.author) : 'Someone'}
                  </span>
                  <span className="text-muted-foreground text-xs">{formatDate(c.createdAt)}</span>
                </p>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
              {viewerId !== undefined && (c.author?.id === viewerId || hike.userId === viewerId) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete comment"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(c.id, { onError: () => toast.error('Could not delete comment') })}
                  className="text-muted-foreground"
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {viewerId !== undefined && (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_COMMENT_LENGTH}
            rows={2}
            placeholder="Write a comment…"
            aria-label="Comment"
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-y rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!draft.trim() || post.isPending}>
              {post.isPending ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
