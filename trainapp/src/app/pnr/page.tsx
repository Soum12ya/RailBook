import { Suspense } from 'react'
import PNRContent from './PNRContent'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PNRContent />
    </Suspense>
  )
}
