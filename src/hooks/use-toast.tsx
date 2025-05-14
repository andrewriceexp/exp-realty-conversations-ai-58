import * as React from "react"
import {
  Toast,
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 10
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: "default" | "destructive" | "success" | "warning"
  duration?: number
  open?: boolean // Added the missing open property
}

type ToastActionType = 
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> & { id: string } }
  | { type: "DISMISS_TOAST"; id: string }
  | { type: "REMOVE_TOAST"; id: string }

interface ToastState {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
}

const toastReducer = (state: ToastState, action: ToastActionType): ToastState => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id
            ? { ...t, ...action.toast }
            : t
        ),
      }

    case "DISMISS_TOAST": {
      const { id } = action

      // First dismiss the toast
      if (id) {
        const newState = {
          ...state,
          toasts: state.toasts.map((t) =>
            t.id === id ? { ...t, open: false } : t
          ),
        }
        
        // Then set a timeout to remove it completely
        if (toastTimeouts.has(id)) {
          clearTimeout(toastTimeouts.get(id))
          toastTimeouts.delete(id)
        }
        
        const timeout = setTimeout(() => {
          toastDispatch({
            type: "REMOVE_TOAST",
            id,
          })
        }, TOAST_REMOVE_DELAY)
        
        toastTimeouts.set(id, timeout)
        
        return newState
      }
      return state
    }
      
    case "REMOVE_TOAST": {
      if (action.id) {
        const newState = {
          ...state,
          toasts: state.toasts.filter((t) => t.id !== action.id),
        }
        return newState
      }
      return state
    }
  }
}

const initialState: ToastState = {
  toasts: [],
}

let toastDispatch: React.Dispatch<ToastActionType> = () => {}

const ToastContext = React.createContext<{
  state: ToastState
  dispatch: React.Dispatch<ToastActionType>
}>({
  state: initialState,
  dispatch: () => null,
})

export const useToast = () => {
  const { state, dispatch } = React.useContext(ToastContext)

  React.useEffect(() => {
    toastDispatch = dispatch
  }, [dispatch])

  const toast = React.useMemo(
    () => ({
      ...state,
      dismiss: (id: string) => dispatch({ type: "DISMISS_TOAST", id }),
      toast: (props: ToasterToast) => {
        const id = props.id || String(Date.now())
        
        // Handle auto-dismiss based on duration directly when creating the toast
        if (props.duration) {
          setTimeout(() => {
            dispatch({ type: "DISMISS_TOAST", id });
          }, props.duration);
        }
        
        dispatch({
          type: "ADD_TOAST",
          toast: {
            ...props,
            id,
            open: true, // Always set open to true when creating a toast
          },
        })
        
        return id
      },
    }),
    [state, dispatch]
  )

  return toast
}

export function ToastProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, dispatch] = React.useReducer(toastReducer, initialState)

  return (
    <ToastContext.Provider value={{ state, dispatch }}>
      {children}
    </ToastContext.Provider>
  )
}

export const toast = (props: Omit<ToasterToast, "id">) => {
  const id = String(Date.now())
  
  const toastData = {
    ...props,
    id,
    open: true, // Always set open to true when creating a toast
    onOpenChange: (open: boolean) => {
      if (!open) {
        toastDispatch({
          type: "DISMISS_TOAST",
          id,
        })
      }
    },
  }

  toastDispatch({
    type: "ADD_TOAST",
    toast: toastData,
  })

  // Auto-dismiss based on duration
  if (props.duration) {
    setTimeout(() => {
      toastDispatch({
        type: "DISMISS_TOAST",
        id,
      })
    }, props.duration)
  }

  return id
}

// Types
export type { 
  ToasterToast as Toast,
  ToastProps,
  ToastActionElement
}
