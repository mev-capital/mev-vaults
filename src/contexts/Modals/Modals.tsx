import React, { createContext, useCallback, useState } from 'react';

interface ModalsContext {
    content?: React.ReactNode;
    isOpen?: boolean;
    onPresent: (content: React.ReactNode, key?: string) => void;
    onDismiss: () => void;
}

export const Context = createContext<ModalsContext>({
    onPresent: () => {},
    onDismiss: () => {},
});

const Modals: React.FC = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState<React.ReactNode>();
    const [modalKey, setModalKey] = useState<string>();

    const handlePresent = useCallback(
        (modalContent: React.ReactNode, key?: string) => {
            setModalKey(key);
            setContent(modalContent);
            setIsOpen(true);
        },
        [setContent, setIsOpen, setModalKey]
    );

    const handleDismiss = useCallback(() => {
        setContent(undefined);
        setIsOpen(false);
    }, [setContent, setIsOpen]);

    return (
        <Context.Provider
            value={{
                content,
                isOpen,
                onPresent: handlePresent,
                onDismiss: handleDismiss,
            }}
        >
            {children}
            {isOpen && (
                <div>
                    <div onClick={handleDismiss} />
                    {React.isValidElement(content) &&
                        React.cloneElement(content, {
                            onDismiss: handleDismiss,
                        })}
                </div>
            )}
        </Context.Provider>
    );
};

export default Modals;
