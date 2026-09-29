import { ChevronDown, MessageCircle, SendHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/message'
import { Textarea } from '@/components/ui/textarea'
import { displayName } from '@/features/account/displayName'
import { UserAvatar } from '@/features/account/UserAvatar'
import type { Hike } from '@/features/hikes/api'
import { ApiError } from '@/lib/api'
import { dateFormat } from '@/lib/format'
import { cn } from '@/lib/utils'

import { MAX_COMMENT_LENGTH, useComments, useDeleteComment, usePostComment, type Comment } from './api'


type Props = {
  hike: Hike
  /** The signed-in viewer; only they can write. */
  viewerId: string | undefined
}

/**
 * A hike's comments as a chat in a floating panel, collapsed to a button by
 * default. Opens on its own when the page is reached through #comments.
 */
export function CommentsPanel({ hike, viewerId }: Props) {
  const [open, setOpen] = useState(() => window.location.hash === '#comments')
  const comments = useComments(hike.id)
  const list = comments.data ?? []
  const count = hike.interactions?.comments ?? list.length

  if (viewerId === undefined && count === 0) return null

  return (
    <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2">
      {open ? (
        <section
          aria-label="Comments"
          className="bg-background flex h-[min(34rem,calc(100svh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border shadow-xl"
        >
          <header className="flex items-center gap-2 border-b px-3 py-2">
            <MessageCircle className="text-muted-foreground size-4" />
            <h2 className="flex-1 text-sm font-medium">Comments{list.length > 0 && ` · ${list.length}`}</h2>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Hide comments">
              <ChevronDown />
            </Button>
          </header>
          <Thread hike={hike} comments={list} viewerId={viewerId} loading={comments.isLoading} />
          {viewerId !== undefined ? (
            <Composer hikeId={hike.id} />
          ) : (
            <p className="text-muted-foreground border-t px-3 py-2 text-center text-xs">
              <Link to="/login" className="text-foreground underline">
                Sign in
              </Link>{' '}
              to comment.
            </p>
          )}
        </section>
      ) : (
        <Button className="rounded-full shadow-lg" onClick={() => setOpen(true)}>
          <MessageCircle />
          {count > 0 ? `Comments · ${count}` : 'Comment'}
        </Button>
      )}
    </div>
  )
}

function Thread({
  hike,
  comments,
  viewerId,
  loading,
}: {
  hike: Hike
  comments: Comment[]
  viewerId: string | undefined
  loading: boolean
}) {
  const remove = useDeleteComment(hike.id)
  const end = useRef<HTMLDivElement>(null)

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [comments.length])

  if (!loading && comments.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-sm">
        No comments yet. Say something about this hike!
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
      {comments.map((c, i) => {
        const mine = c.author?.id === viewerId
        const byOwner = c.author?.id === hike.userId
        // Consecutive messages from one person read as one block.
        const sameAuthor = i > 0 && comments[i - 1].author?.id === c.author?.id
        const endsRun = comments[i + 1]?.author?.id !== c.author?.id
        const canDelete = viewerId !== undefined && (mine || hike.userId === viewerId)
        return (
          <Message key={c.id} align={mine ? 'end' : 'start'} className={cn(sameAuthor && '-mt-1.5')}>
            <MessageAvatar className={cn('bg-transparent', sameAuthor && 'invisible')}>
              {c.author && (
                <Link to={`/u/${c.author.id}`} aria-label={displayName(c.author)}>
                  <UserAvatar user={c.author} className="size-8" />
                </Link>
              )}
            </MessageAvatar>
            <MessageContent className="gap-1">
              {!sameAuthor && (
                <MessageHeader className="gap-1.5">
                  {mine ? 'You' : c.author ? displayName(c.author) : 'Someone'}
                  {byOwner && <span className="bg-primary text-primary-foreground rounded px-1 text-[10px] uppercase">Owner</span>}
                </MessageHeader>
              )}
              <Bubble variant={byOwner ? 'default' : 'muted'} align={mine ? 'end' : 'start'}>
                <BubbleContent className="whitespace-pre-wrap">{c.body}</BubbleContent>
              </Bubble>
              {(endsRun || canDelete) && (
                <MessageFooter className="gap-1">
                  {endsRun && (
                    <time dateTime={c.createdAt} className="font-normal">
                      {dateFormat({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(c.createdAt))}
                    </time>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(c.id, { onError: () => toast.error('Could not delete comment') })}
                      className="hover:text-destructive rounded p-0.5"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </MessageFooter>
              )}
            </MessageContent>
          </Message>
        )
      })}
      <div ref={end} />
    </div>
  )
}

function Composer({ hikeId }: { hikeId: string }) {
  const post = usePostComment(hikeId)
  const [draft, setDraft] = useState('')

  function send(e?: FormEvent) {
    e?.preventDefault()
    if (!draft.trim() || post.isPending) return
    post.mutate(draft, {
      onSuccess: () => setDraft(''),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not post comment'),
    })
  }

  // Enter sends, Shift+Enter starts a new line.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <form onSubmit={send} className="flex items-end gap-2 border-t p-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={MAX_COMMENT_LENGTH}
        rows={1}
        placeholder="Write a comment…"
        aria-label="Comment"
        className="max-h-32 min-h-9 resize-none py-1.5"
      />
      <Button type="submit" size="icon" disabled={!draft.trim() || post.isPending} aria-label="Send comment">
        <SendHorizontal />
      </Button>
    </form>
  )
}
