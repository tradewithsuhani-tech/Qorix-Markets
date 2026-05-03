import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

if (Platform.OS === "web" && typeof document !== "undefined") {
  const id = "styled-input-autofill-reset";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 1000px #1A1F28 inset !important;
        box-shadow: 0 0 0 1000px #1A1F28 inset !important;
        -webkit-text-fill-color: #FFFFFF !important;
        caret-color: #A855F7 !important;
        transition: background-color 9999s ease-in-out 0s !important;
        background-color: transparent !important;
        background-clip: content-box !important;
      }
      input:focus, input:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        border: none !important;
      }
      /* Nuke common email-helper extension injected widgets (TempMail, MailDrop, etc.) */
      [class*="tempmail" i],
      [id*="tempmail" i],
      [class*="temp-mail" i],
      [id*="temp-mail" i],
      [class*="temp_mail" i],
      [class*="mailtm" i],
      [class*="maildrop" i],
      [data-tempmail],
      iframe[src*="temp-mail"],
      iframe[src*="tempmail"],
      div[style*="tempmail" i] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  const cleanInjected = () => {
    const selectors = [
      '[class*="tempmail" i]',
      '[id*="tempmail" i]',
      '[class*="temp-mail" i]',
      '[class*="temp_mail" i]',
      '[class*="mailtm" i]',
      '[class*="maildrop" i]',
      '[data-tempmail]',
      'iframe[src*="tempmail"]',
      'iframe[src*="temp-mail"]',
    ];
    selectors.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          (el as HTMLElement).style.display = "none";
          (el as HTMLElement).remove();
        });
      } catch {}
    });
  };
  cleanInjected();
  const bodyObserver = new MutationObserver(cleanInjected);
  if (document.body) {
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    });
  }
}

interface StyledInputProps extends TextInputProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  label?: string;
  rightIcon?: React.ComponentProps<typeof Feather>["name"];
  onRightIconPress?: () => void;
  error?: boolean;
}

export function StyledInput({
  icon,
  label,
  rightIcon,
  onRightIconPress,
  error,
  style,
  ...props
}: StyledInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [readOnlyGuard, setReadOnlyGuard] = useState(Platform.OS === "web");
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node: HTMLInputElement | null = inputRef.current;
    if (!node) return;
    try {
      if (!props.secureTextEntry) node.setAttribute("type", "text");
      node.setAttribute("autocomplete", "off");
      node.setAttribute("data-lpignore", "true");
      node.setAttribute("data-1p-ignore", "true");
      node.setAttribute("data-form-type", "other");
    } catch {}
    const parent = node.parentElement;
    if (!parent) return;
    const original = new Set(Array.from(parent.children));
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1 && !original.has(n as Element)) {
            (n as HTMLElement).style.display = "none";
          }
        });
      });
    });
    observer.observe(parent, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, [props.secureTextEntry]);

  const borderColor = error
    ? colors.red
    : focused
    ? colors.gold
    : "rgba(201,168,76,0.35)";

  const bgColor = focused ? "#1E1A2A" : "#1A1F28";

  return (
    <View>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: bgColor,
            borderColor,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
        {...(Platform.OS === "web"
          ? ({ "data-styled-input-wrap": "true" } as any)
          : {})}
      >
        <View {...(Platform.OS === "web" ? ({ "data-styled-input-keep": "true" } as any) : {})}>
          <Feather
            name={icon}
            size={16}
            color={focused ? colors.gold : colors.textSecondary}
          />
        </View>
        <TextInput
          ref={inputRef}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            if (readOnlyGuard) setReadOnlyGuard(false);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: colors.foreground },
            Platform.OS === "web" && ({
              outline: "none",
              outlineWidth: 0,
              outlineStyle: "none",
              outlineColor: "transparent",
              outlineOffset: 0,
              boxShadow: "none",
              WebkitBoxShadow: `0 0 0 1000px #1A1F28 inset`,
              WebkitTextFillColor: colors.foreground,
              caretColor: colors.gold,
              border: "none",
              backgroundColor: "transparent",
            } as any),
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          cursorColor={colors.gold}
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          {...(Platform.OS === "web"
            ? ({
                "data-styled-input-keep": "true",
                "data-form-type": "other",
                "data-lpignore": "true",
                "data-1p-ignore": "true",
                "data-tempmail-ignore": "true",
                readOnly: readOnlyGuard,
                name: `field-${icon}-${Math.random().toString(36).slice(2, 8)}`,
                type: props.secureTextEntry ? "password" : "text",
                inputMode:
                  props.keyboardType === "email-address"
                    ? "email"
                    : props.keyboardType === "phone-pad"
                    ? "tel"
                    : props.keyboardType === "numeric" ||
                      props.keyboardType === "number-pad"
                    ? "numeric"
                    : "text",
              } as any)
            : {})}
        />
        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={10}
            {...(Platform.OS === "web"
              ? ({ "data-styled-input-keep": "true" } as any)
              : {})}
          >
            <Feather name={rightIcon} size={16} color={colors.textSecondary} />
          </Pressable>
        )}
        {Platform.OS === "web" && !rightIcon && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 0,
              top: 1,
              bottom: 1,
              width: 56,
              backgroundColor: bgColor,
              borderTopRightRadius: 11,
              borderBottomRightRadius: 11,
              zIndex: 10,
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    height: "100%",
    ...(Platform.OS === "web" ? { paddingRight: 60 } : null),
  },
});
