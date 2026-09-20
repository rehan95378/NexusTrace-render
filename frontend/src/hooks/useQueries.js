import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

// Cases
export const useListCases = () =>
  useQuery({
    queryKey: ['cases'],
    queryFn: () => api.listCases(),
  })

export const useCreateCase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name) => api.createCase(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cases'] }),
  })
}

export const useDeleteCase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (caseId) => api.deleteCase(caseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cases'] }),
  })
}

// Graph
export const useGraph = (caseId) =>
  useQuery({
    queryKey: ['graph', caseId],
    queryFn: () => (caseId ? api.graph(caseId) : null),
    enabled: !!caseId,
  })

export const useAllGraph = () =>
  useQuery({
    queryKey: ['graph', 'all'],
    queryFn: () => api.allGraph(),
  })

// Entities
export const useEntities = (caseId) =>
  useQuery({
    queryKey: ['entities', caseId],
    queryFn: () => (caseId ? api.entities(caseId) : null),
    enabled: !!caseId,
  })

export const useAllEntities = () =>
  useQuery({
    queryKey: ['entities', 'all'],
    queryFn: () => api.allEntities(),
  })

// Key Players
export const useKeyPlayers = (caseId) =>
  useQuery({
    queryKey: ['key-players', caseId],
    queryFn: () => (caseId ? api.keyPlayers(caseId) : null),
    enabled: !!caseId,
  })

// Anomalies
export const useAnomalies = (caseId) =>
  useQuery({
    queryKey: ['anomalies', caseId],
    queryFn: () => (caseId ? api.anomalies(caseId) : null),
    enabled: !!caseId,
  })

// Health
export const useHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    staleTime: 30 * 1000, // 30 seconds
  })

// Audit Trail
export const useAuditTrail = () =>
  useQuery({
    queryKey: ['audit-trail'],
    queryFn: () => api.auditAll(),
  })

// Graph Editing
export const useAddNode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, type, value }) => api.addNode(caseId, type, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export const useAddEdge = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, sourceId, targetId, label }) =>
      api.addEdge(caseId, sourceId, targetId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export const useDeleteNode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, nodeId }) => api.deleteNode(caseId, nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

export const useDeleteEdge = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, edgeId }) => api.deleteEdge(caseId, edgeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph'] })
    },
  })
}

// Ingestion
export const useIngest = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, firText, cdrText, appendMode }) =>
      api.ingest(caseId, firText, cdrText, appendMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph'] })
      queryClient.invalidateQueries({ queryKey: ['entities'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export const useClearCase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (caseId) => api.clearCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph'] })
      queryClient.invalidateQueries({ queryKey: ['entities'] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}
