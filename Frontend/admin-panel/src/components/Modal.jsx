import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = "max-w-lg",

  // true hone par desktop par modal sidebar ko exclude karega.
  // Existing pages par default false rahega.
  contentArea = false,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [open, onClose]);

  if (
    !open ||
    typeof document === "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div
      className={`
        fixed
        inset-y-0
        right-0
        left-0
        z-[9999]
        flex
        items-center
        justify-center
        p-3
        sm:p-5
        lg:p-8

        ${
          contentArea
            ? "lg:left-64"
            : ""
        }
      `}
    >
      {/* BACKDROP */}
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="
          absolute
          inset-0
          cursor-default
          bg-slate-950/55
          backdrop-blur-[2px]
          animate-fade-in
        "
      />

      {/* MODAL */}
      <div
        className={`
          relative
          z-10
          flex
          w-full
          ${maxWidthClass}
          min-w-0
          flex-col
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-[0_28px_90px_rgba(15,23,42,0.4)]
          animate-modal-in

          max-h-[92dvh]
          sm:max-h-[88dvh]
          lg:max-h-[84dvh]
          xl:max-h-[82dvh]

          dark:border-slate-700
          dark:bg-slate-900
        `}
      >
        {/* HEADER */}
        <div
          className="
            flex
            shrink-0
            items-start
            justify-between
            gap-4
            border-b
            border-slate-200
            px-4
            py-4
            dark:border-slate-800
            sm:px-6
            sm:py-5
          "
        >
          <div className="min-w-0 flex-1">
            <h3
              className="
                break-words
                text-base
                font-bold
                text-slate-900
                dark:text-white
                sm:text-lg
              "
            >
              {title}
            </h3>

            {subtitle ? (
              <p
                className="
                  mt-1
                  max-w-4xl
                  break-words
                  text-xs
                  leading-5
                  text-slate-500
                  dark:text-slate-400
                  sm:text-sm
                "
              >
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="
              shrink-0
              rounded-lg
              p-2
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
              dark:hover:bg-slate-800
              dark:hover:text-white
            "
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div
          className="
            min-h-0
            min-w-0
            flex-1
            overflow-y-auto
            overscroll-contain
            px-4
            py-4
            sm:px-6
            sm:py-5
          "
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;