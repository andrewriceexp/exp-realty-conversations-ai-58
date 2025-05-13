
import * as React from "react"
import {
  Toast,
  ToastActionElement,
  ToastProps
} from "@/components/ui/toast"

// Define toast state types
const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// Create a toast context
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast> & { id: string }
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: string
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: string
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const reducer = (state: State, action: Action): State => {
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
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects should not be in the reducer
      // ! But this is a special case
      if (toastId) {
        if (toastTimeouts.has(toastId)) {
          clearTimeout(toastTimeouts.get(toastId))
          toastTimeouts.delete(toastId)
        }
      } else {
        for (const [id, timeout] of toastTimeouts.entries()) {
          clearTimeout(timeout)
          toastTimeouts.delete(id)
        }
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// Toast helper function
const toastFunction = (props: Omit<ToasterToast, "id">) => {
  const { addToast } = useToast()
  return addToast(props)
}

type ToastContextType = {
  toasts: ToasterToast[]
  addToast: (props: Omit<ToasterToast, "id">) => string
  updateToast: (props: Partial<ToasterToast> & { id: string }) => void
  dismissToast: (toastId?: string) => void
  removeToast: (toastId?: string) => void
  toast: (props: Omit<ToasterToast, "id">) => string // Add toast function to context
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = React.useContext(ToastContext)

  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return context
}

export function ToastProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, dispatch] = React.useReducer(reducer, {
    toasts: [],
  })

  React.useEffect(() => {
    state.toasts.forEach((toast) => {
      if (toast.open === false && !toastTimeouts.has(toast.id)) {
        const timeout = setTimeout(() => {
          dispatch({
            type: "REMOVE_TOAST",
            toastId: toast.id,
          })
        }, TOAST_REMOVE_DELAY)

        toastTimeouts.set(toast.id, timeout)
      }
    })
  }, [state.toasts])

  const addToast = React.useCallback(
    (props: Omit<ToasterToast, "id">) => {
      const id = genId()

      const newToast = {
        ...props,
        id,
        open: true,
      }

      dispatch({
        type: "ADD_TOAST",
        toast: newToast,
      })

      return id
    },
    [dispatch]
  )

  const updateToast = React.useCallback(
    (props: Partial<ToasterToast> & { id: string }) => {
      dispatch({
        type: "UPDATE_TOAST",
        toast: props,
      })
    },
    [dispatch]
  )

  const dismissToast = React.useCallback(
    (toastId?: string) => {
      dispatch({
        type: "DISMISS_TOAST",
        toastId,
      })
    },
    [dispatch]
  )

  const removeToast = React.useCallback(
    (toastId?: string) => {
      dispatch({
        type: "REMOVE_TOAST",
        toastId,
      })
    },
    [dispatch]
  )

  // Include the toast function in the same context
  const toast = React.useCallback(
    (props: Omit<ToasterToast, "id">) => {
      return addToast(props);
    },
    [addToast]
  )

  return (
    <ToastContext.Provider
      value={{
        toasts: state.toasts,
        addToast,
        updateToast,
        dismissToast,
        removeToast,
        toast, // Include the toast function in the provided context
      }}
    >
      {children}
    </ToastContext.Provider>
  )
}

// Standalone toast function for direct usage without hooks
export const toast = (props: Omit<ToasterToast, "id">) => {
  // This is tricky in a non-component context, so we'll use a workaround
  // Create a dummy element and render the provider + a component that uses the hook
  // This only works in a browser environment
  if (typeof document !== "undefined") {
    const addToastFn = useToast().addToast;
    return addToastFn(props);
  }
  
  console.warn("Toast was called outside of a component context");
  return ""; // Return an empty string as ID when not in a component context
}
