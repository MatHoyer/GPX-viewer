import { Footprints } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { useRecord } from '@/features/record/store'

/** Opens the recorder on this planned route; a recording already under way is kept as is. */
export function FollowButton({ id }: { id: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        useRecord.getState().follow(id)
        navigate('/record')
      }}
    >
      <Footprints />
      {t('record.followRoute')}
    </Button>
  )
}
