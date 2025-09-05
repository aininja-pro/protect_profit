import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface AnalysisNotificationProps {
  message: string;
  type: 'analysis' | 'recommendation' | 'alert';
  duration?: number; // Auto-hide after duration (ms)
  onDismiss?: () => void;
}

export default function AnalysisNotification({ 
  message, 
  type, 
  duration = 5000, 
  onDismiss 
}: AnalysisNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const getNotificationStyles = () => {
    switch (type) {
      case 'analysis':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'recommendation':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'alert':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'analysis': return '📊';
      case 'recommendation': return '💡';
      case 'alert': return '⚠️';
      default: return 'ℹ️';
    }
  };

  if (!isVisible) return null;

  return (
    <div className={cn(
      "flex items-center space-x-3 p-3 rounded-lg border transition-all duration-300",
      getNotificationStyles(),
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
    )}>
      <div className="text-lg">{getIcon()}</div>
      <div className="flex-1 text-sm font-medium">{message}</div>
      <button
        onClick={() => {
          setIsVisible(false);
          onDismiss?.();
        }}
        className="text-gray-500 hover:text-gray-700"
      >
        ✕
      </button>
    </div>
  );
}