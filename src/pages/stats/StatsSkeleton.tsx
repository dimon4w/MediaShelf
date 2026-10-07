import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/cn'

const BAR_HEIGHTS = [38, 62, 24, 70, 46, 84, 30, 56, 66, 40, 78, 52]

function CardSkeleton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl bg-raised p-4 ring-1 ring-line ring-inset sm:p-5', className)}>
      <div className="mb-5 flex h-[22px] items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3.5 w-14" />
      </div>
      {children}
    </div>
  )
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index}>
          <div className="flex h-5 items-center justify-between">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-12" />
          </div>
          <Skeleton className="mt-2 h-1.5 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Mirrors the loaded layout so nothing jumps when data arrives. */
export function StatsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="@container">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line ring-1 ring-line @2xl:grid-cols-3 @5xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="bg-raised p-4 sm:p-5">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-24" />
              </div>
              <div className="mt-2 flex h-[38px] items-center sm:h-12">
                <Skeleton className="h-7 w-16 sm:h-9 sm:w-20" />
              </div>
              <div className="mt-1 flex h-4 items-center">
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="@container mt-4">
        <div className="grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
          <CardSkeleton className="@2xl:col-span-2">
            <div className="flex h-44 items-end gap-1 pl-8 sm:h-52 sm:gap-2">
              {BAR_HEIGHTS.map((height, index) => (
                <div key={index} className="flex h-full flex-1 items-end justify-center">
                  <Skeleton
                    className="w-full max-w-10 rounded-t-[5px] rounded-b-[1px]"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 h-3.5" />
          </CardSkeleton>
          <CardSkeleton>
            <Skeleton className="h-2.5 rounded-full" />
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              ))}
            </div>
          </CardSkeleton>
          <CardSkeleton>
            <RowsSkeleton rows={4} />
          </CardSkeleton>
          <CardSkeleton>
            <RowsSkeleton rows={5} />
          </CardSkeleton>
          <CardSkeleton>
            <div className="h-44" />
          </CardSkeleton>
        </div>
      </div>
    </div>
  )
}
