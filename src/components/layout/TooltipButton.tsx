import React, { useRef } from 'react';

interface TooltipButtonProps {
    label: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    onDoubleClick?: (e: React.MouseEvent) => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseUp?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    className?: string;
    style?: React.CSSProperties;
    disabled?: boolean;
    tooltipSide?: 'left' | 'right' | 'auto';
    as?: 'button' | 'div';
    draggable?: boolean;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

const TooltipButton: React.FC<TooltipButtonProps> = ({
    label: _label,
    children,
    onClick,
    onDoubleClick,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    className,
    style,
    disabled,
    as = 'button',
    draggable,
    onDragOver,
    onDragLeave,
    onDrop,
    onContextMenu,
    buttonRef,
}) => {
    const internalRef = useRef<HTMLElement>(null);
    const ref = (buttonRef as React.RefObject<HTMLElement>) ?? internalRef;

    const commonProps = {
        className,
        style,
        disabled,
        onClick,
        onDoubleClick,
        onMouseDown,
        onMouseUp,
        onMouseLeave,
        draggable,
        onDragOver,
        onDragLeave,
        onDrop,
        onContextMenu,
    };

    if (as === 'div') {
        return (
            <div {...commonProps} ref={ref as React.RefObject<HTMLDivElement>}>
                {children}
            </div>
        );
    }

    return (
        <button
            {...commonProps}
            ref={ref as React.RefObject<HTMLButtonElement>}
        >
            {children}
        </button>
    );
};

export default TooltipButton;
