import React from "react";
import { Button } from "./Button";
import { FolderOpen, Plus } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-ink bg-page my-4">
      <div className="w-14 h-14 bg-panel border-line shadow-sm flex items-center justify-center mb-4 text-ink">
        {icon || <FolderOpen className="w-7 h-7 text-ink" />}
      </div>

      <h3 className="font-display font-bold text-lg text-text uppercase tracking-tight">
        {title}
      </h3>

      <p className="text-sm text-muted max-w-md mt-1.5 mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button variant="lime" size="md" onClick={onAction}>
          <Plus className="w-4 h-4 mr-1" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
