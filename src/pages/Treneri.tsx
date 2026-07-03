import { UserCog } from 'lucide-react'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export default function Treneri() {
  return (
    <PagePlaceholder
      title="Treneri"
      subtitle="Svi treneri na platformi, njihovi nalozi i status pretplate."
      icon={UserCog}
    />
  )
}
