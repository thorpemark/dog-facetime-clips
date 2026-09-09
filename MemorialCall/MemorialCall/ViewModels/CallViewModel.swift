import AVFoundation
import Combine
import Foundation
import UIKit

@MainActor
final class CallViewModel: ObservableObject {
    @Published var callPhase: CallPhase = .onboarding
    @Published var behaviorState: BehaviorState = .idle
    @Published var isMuted = false
    @Published var showDebugPanel = false
    @Published var rulesConfig: KeywordRulesConfig?

    let videoMixer = VideoMixer()
    let keywordSpotter = KeywordSpotter()

    private var cooldownTask: Task<Void, Never>?
    private let cooldownDuration: TimeInterval = 0.8
    private var dogName = DogProfile.defaultProfile.dogName
    private var ownerName = DogProfile.defaultProfile.ownerName
    private var cancellables = Set<AnyCancellable>()

    init() {
        rulesConfig = KeywordRulesLoader.load()
        if let config = rulesConfig {
            videoMixer.configure(with: config)
        }

        keywordSpotter.onMatch = { [weak self] ruleID in
            Task { @MainActor in
                self?.triggerReaction(clipID: ruleID)
            }
        }

        keywordSpotter.objectWillChange
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    func beginIncomingCall() {
        callPhase = .incoming
        playRingtone()
    }

    func acceptCall() {
        callPhase = .active
        behaviorState = .idle
        AudioSessionManager.configureForCall()
        videoMixer.loadIdle()
        transitionToListen()
    }

    func endCall() {
        callPhase = .ended
        behaviorState = .idle
        keywordSpotter.stopListening()
        videoMixer.stop()
        AudioSessionManager.deactivate()
        cooldownTask?.cancel()
    }

    func returnToIdleAfterEnd() {
        callPhase = .onboarding
    }

    func toggleMute() {
        isMuted.toggle()
        if isMuted {
            keywordSpotter.stopListening()
        } else if callPhase == .active, case .listen = behaviorState {
            startListening()
        }
    }

    func transitionToListen() {
        guard callPhase == .active else { return }
        if case .react = behaviorState { return }
        behaviorState = .listen
        startListening()
    }

    /// Debug / manual trigger — also used when keyword spotter fires.
    func triggerReaction(clipID: String) {
        guard callPhase == .active else { return }
        guard behaviorState != .react(clipID: clipID) else { return }

        switch behaviorState {
        case .react, .cooldown:
            return
        default:
            break
        }

        behaviorState = .react(clipID: clipID)
        keywordSpotter.stopListening()
        provideHaptic()

        videoMixer.playReaction(clipID: clipID) { [weak self] in
            Task { @MainActor in
                self?.enterCooldown()
            }
        }
    }

    func requestSpeechAuthorization() async {
        _ = await keywordSpotter.requestAuthorization()
    }

    private func startListening() {
        guard !isMuted, let config = rulesConfig else { return }
        keywordSpotter.startListening(
            rules: config.rules,
            dogName: dogName,
            ownerName: ownerName
        )
    }

    func updateListeningProfile(dogName: String, ownerName: String) {
        self.dogName = dogName
        self.ownerName = ownerName
        guard callPhase == .active, behaviorState == .listen, !isMuted,
              let config = rulesConfig else { return }
        keywordSpotter.startListening(rules: config.rules, dogName: dogName, ownerName: ownerName)
    }

    private func enterCooldown() {
        behaviorState = .cooldown
        cooldownTask?.cancel()
        cooldownTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(cooldownDuration * 1_000_000_000))
            guard !Task.isCancelled, callPhase == .active else { return }
            transitionToListen()
        }
    }

    private func playRingtone() {
        // Simple system sound as ringtone placeholder
        AudioServicesPlaySystemSound(1005)
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    private func provideHaptic() {
        let generator = UIImpactFeedbackGenerator(style: .soft)
        generator.impactOccurred()
    }
}

import AudioToolbox
