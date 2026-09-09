import SwiftUI

struct ActiveCallView: View {
    @EnvironmentObject var profileStore: ProfileStore
    @EnvironmentObject var callViewModel: CallViewModel

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            DualVideoView(mixer: callViewModel.videoMixer)
                .ignoresSafeArea()

            VStack {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(profileStore.profile.dogName)
                            .font(.headline)
                            .foregroundStyle(.white)
                        HStack(spacing: 6) {
                            Circle()
                                .fill(statusCueColor)
                                .frame(width: 8, height: 8)
                            Text(statusCue.label)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(statusCueColor)
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)

                Spacer()

                HStack {
                    Spacer()
                    CameraPreviewPlaceholder()
                        .padding(.trailing, 16)
                        .padding(.bottom, 8)
                }

                CallControlsView()
                    .padding(.bottom, 40)

                if callViewModel.showDebugPanel {
                    DebugPanelView()
                        .padding(.bottom, 16)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .onAppear {
            callViewModel.updateListeningProfile(
                dogName: profileStore.profile.dogName,
                ownerName: profileStore.profile.ownerName
            )
        }
        .onChange(of: profileStore.profile.dogName) { _, newValue in
            callViewModel.updateListeningProfile(
                dogName: newValue,
                ownerName: profileStore.profile.ownerName
            )
        }
    }

    private var statusCue: CallListenCue {
        CallListenStatus.cue(
            behavior: callViewModel.behaviorState,
            isMuted: callViewModel.isMuted,
            speechActuallyListening: callViewModel.keywordSpotter.isListening
        )
    }

    private var statusCueColor: Color {
        switch statusCue.kind {
        case .listening: return Color(red: 0.49, green: 1.0, blue: 0.70)
        case .gettingReady: return Color(red: 1.0, green: 0.84, blue: 0.04)
        case .busy: return Color(red: 1.0, green: 0.62, blue: 0.04)
        case .muted: return Color.white.opacity(0.45)
        }
    }
}
