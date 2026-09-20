import { useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs'
import { useCaseStore } from '../store/caseStore'

export default function CaseOverview() {
  const { selectedCaseId, cases } = useCaseStore()
  const activeCase = cases.find(c => c.id === selectedCaseId)
  const [activeTab, setActiveTab] = useState('intelligence')

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <div className="bg-light-panel dark:bg-panel border border-light-border dark:border-border rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-light-text dark:text-text">
              {activeCase ? activeCase.name : 'No Case Selected'}
            </h1>
            <p className="text-light-muted dark:text-muted mt-1">
              {activeCase
                ? `${activeCase.entity_count} entities, ${activeCase.edge_count || 0} relationships`
                : 'Select a case to view its overview'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          {/* Intelligence Tab */}
          <TabsContent value="intelligence" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Panel className="p-6">
                <h3 className="text-sm font-medium text-light-muted dark:text-muted mb-2">Key Players</h3>
                <p className="text-3xl font-display font-semibold text-light-text dark:text-text">
                  {activeCase?.key_players_count || 0}
                </p>
                <p className="text-xs text-light-muted dark:text-muted mt-1">PageRank analysis</p>
              </Panel>
              <Panel className="p-6">
                <h3 className="text-sm font-medium text-light-muted dark:text-muted mb-2">Anomalies</h3>
                <p className="text-3xl font-display font-semibold text-light-text dark:text-text">
                  {activeCase?.anomalies_count || 0}
                </p>
                <p className="text-xs text-light-muted dark:text-muted mt-1">Detected patterns</p>
              </Panel>
              <Panel className="p-6">
                <h3 className="text-sm font-medium text-light-muted dark:text-muted mb-2">Connections</h3>
                <p className="text-3xl font-display font-semibold text-light-text dark:text-text">
                  {activeCase?.edge_count || 0}
                </p>
                <p className="text-xs text-light-muted dark:text-muted mt-1">Relationships found</p>
              </Panel>
            </div>
          </TabsContent>

          {/* Evidence Tab */}
          <TabsContent value="evidence" className="space-y-4">
            <Panel title="Extracted Entities" hint="Entities extracted from investigation data">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-light-muted dark:text-muted font-normal border-b border-light-border dark:border-border">
                      <th className="pb-3 font-medium text-light-text dark:text-text">Type</th>
                      <th className="pb-3 font-medium text-light-text dark:text-text">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCase?.entity_counts ? (
                      Object.entries(activeCase.entity_counts).map(([type, count]) => (
                        <tr key={type} className="border-b border-light-border dark:border-border/50">
                          <td className="py-3 capitalize text-light-text dark:text-text">{type.replace('_', ' ')}</td>
                          <td className="py-3 text-light-muted dark:text-muted font-mono">{count}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-light-muted dark:text-muted">
                          No entities extracted yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <Panel title="Case Audit Log" hint="Recent actions on this case">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-light-panel-raised dark:bg-panel-raised border border-light-border dark:border-border/50 rounded-lg">
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-accent mt-1.5" />
                    <div>
                      <p className="text-sm font-medium text-light-text dark:text-text">Analysis completed</p>
                      <p className="text-xs text-light-muted dark:text-muted mt-0.5">System • {i} min ago</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
