
"use client";

import * as React from "react";
import {
  ToastActionElement,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastViewport,
  Toast as ToastPrimitive,
  ToastProvider as ToastProviderPrimitive,
} from "@/components/ui/toast";
import { useToast as useToastPrimitive } from "@radix-ui/react-toast";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

export type ToasterToast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "destructive" | "success" | "warning" | null;
  duration?: number;
};

export type ToastProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | "success" | "warning";
  action?: ToastActionElement;
  duration?: number;
};

export type Toast = ToasterToast;

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
      id: string;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      id: string;
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      id: string;
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { id } = action;

      if (toastTimeouts.has(id)) {
        clearTimeout(toastTimeouts.get(id));
        toastTimeouts.delete(id);
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === id
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }

    case actionTypes.REMOVE_TOAST:
      if (toastTimeouts.has(action.id)) {
        clearTimeout(toastTimeouts.get(action.id));
        toastTimeouts.delete(action.id);
      }

      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };

    default:
      return state;
  }
};

const ToastComponent = ({
  id,
  title,
  description,
  action,
  variant,
  onOpenChange,
}: ToasterToast & {
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <ToastPrimitive variant={variant} onOpenChange={onOpenChange}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action}
      <ToastClose />
    </ToastPrimitive>
  );
};

export const useToast = () => {
  const [state, dispatch] = React.useReducer(reducer, {
    toasts: [],
  });

  const { toasts } = state;

  const toast = React.useCallback(
    ({ title, description, variant, action, duration = 5000 }: ToastProps) => {
      const id = crypto.randomUUID();
      const newToast = {
        id,
        title,
        description,
        variant,
        action,
        duration,
        open: true,
      };

      dispatch({ type: actionTypes.ADD_TOAST, toast: newToast });

      return {
        id,
        dismiss: () => dispatch({ type: actionTypes.DISMISS_TOAST, id }),
        update: (props: ToastProps) =>
          dispatch({
            type: actionTypes.UPDATE_TOAST,
            id,
            toast: { ...props },
          }),
      };
    },
    [dispatch]
  );

  const dismissToast = React.useCallback((id: string) => {
    dispatch({ type: actionTypes.DISMISS_TOAST, id });
  }, []);

  const removeToast = React.useCallback((id: string) => {
    dispatch({ type: actionTypes.REMOVE_TOAST, id });
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        for (const toast of toasts) {
          dismissToast(toast.id);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toasts, dismissToast]);

  return {
    toast,
    toasts,
    dismissToast,
    removeToast,
  };
};

export function ToastAction({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className: _, ...otherProps } = props;
  return (
    <button
      className="inline-flex h-8 items-center justify-center rounded-md bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      {...otherProps}
    >
      {children}
    </button>
  );
}

export const Toaster = () => {
  const { toasts, removeToast } = useToast();

  return (
    <ToastProviderPrimitive swipeDirection="right">
      {toasts.map(({ id, title, description, action, ...props }) => {
        return (
          <ToastComponent
            key={id}
            id={id}
            title={title}
            description={description}
            action={action}
            {...props}
            onOpenChange={(open) => {
              if (!open) {
                removeToast(id);
              }
            }}
          />
        );
      })}
      <ToastViewport />
    </ToastProviderPrimitive>
  );
};

export { toast } from "./toast-utils";
