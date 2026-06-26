import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type BoardScope = { type: 'personal' } | { type: 'team'; teamId: string; teamName: string }

interface BoardContextValue {
  scope: BoardScope
  setPersonalBoard: () => void
  setTeamBoard: (teamId: string, teamName: string) => void
}

const BoardContext = createContext<BoardContextValue | null>(null)

export function BoardProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<BoardScope>({ type: 'personal' })

  const setPersonalBoard = useCallback(() => {
    setScope({ type: 'personal' })
  }, [])

  const setTeamBoard = useCallback((teamId: string, teamName: string) => {
    setScope({ type: 'team', teamId, teamName })
  }, [])

  const value = useMemo(
    () => ({ scope, setPersonalBoard, setTeamBoard }),
    [scope, setPersonalBoard, setTeamBoard],
  )

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}

export function useBoardScope() {
  const context = useContext(BoardContext)
  if (!context) {
    throw new Error('useBoardScope must be used within BoardProvider')
  }
  return context
}
