import { create } from 'zustand'

export const useCaseStore = create((set) => ({
  cases: [],
  selectedCaseId: null,
  loading: false,
  error: null,

  setCases: (cases) => set({ cases }),
  selectCase: (caseId) => set({ selectedCaseId: caseId }),
  addCase: (case_) => set((state) => ({ cases: [...state.cases, case_] })),
  removeCase: (caseId) =>
    set((state) => ({
      cases: state.cases.filter((c) => c.id !== caseId),
      selectedCaseId: state.selectedCaseId === caseId ? null : state.selectedCaseId,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
