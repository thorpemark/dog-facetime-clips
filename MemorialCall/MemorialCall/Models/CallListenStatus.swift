import Foundation

enum CallListenCueKind: Equatable {
    case listening
    case gettingReady
    case busy
    case muted
}

struct CallListenCue: Equatable {
    var kind: CallListenCueKind
    var label: String
}

/// Active-call status. Never “Connected” — phone and web both read
/// Listening… / Getting ready… / Busy reacting…
enum CallListenStatus {
    static func cue(
        behavior: BehaviorState,
        isMuted: Bool,
        speechActuallyListening: Bool
    ) -> CallListenCue {
        if isMuted {
            return CallListenCue(kind: .muted, label: "Muted")
        }

        switch behavior {
        case .react:
            return CallListenCue(kind: .busy, label: "Busy reacting…")
        case .cooldown:
            return CallListenCue(kind: .gettingReady, label: "Getting ready…")
        case .idle:
            if speechActuallyListening {
                return CallListenCue(kind: .listening, label: "Listening…")
            }
            return CallListenCue(kind: .gettingReady, label: "Getting ready…")
        case .listen:
            if speechActuallyListening {
                return CallListenCue(kind: .listening, label: "Listening…")
            }
            return CallListenCue(kind: .gettingReady, label: "Getting ready…")
        }
    }
}
