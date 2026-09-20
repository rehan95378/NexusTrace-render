import Panel from '../components/Panel'

export default function EvidenceProcessing() {
  return (
    <div className="space-y-6">
      <Panel title="Upload Evidence" hint="FIR reports and CDR logs">
        <div className="text-center py-8 text-light-muted dark:text-muted">
          Evidence upload form
        </div>
      </Panel>
      <Panel title="Extraction Progress" hint="Real-time processing status">
        <div className="text-center py-8 text-light-muted dark:text-muted">
          Extraction progress view
        </div>
      </Panel>
    </div>
  )
}
