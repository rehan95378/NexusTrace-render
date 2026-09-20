import Panel from '../components/Panel'

export default function Tables() {
  return (
    <div className="space-y-6">
      <Panel title="Cases" hint="Case management and directory">
        <div className="text-center py-8 text-light-muted dark:text-muted">
          Cases table view
        </div>
      </Panel>
      <Panel title="Entities" hint="Extracted entities with relationships">
        <div className="text-center py-8 text-light-muted dark:text-muted">
          Entities table view
        </div>
      </Panel>
      <Panel title="Key Players" hint="Ranked individuals by centrality">
        <div className="text-center py-8 text-light-muted dark:text-muted">
          Key players table view
        </div>
      </Panel>
      <Panel title="Anomalies" hint="Detected suspicious patterns">
        <div className="text-center py-8 text-light-muted dark:text-muted">
          Anomalies table view
        </div>
      </Panel>
    </div>
  )
}
