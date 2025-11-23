import Foundation
import UIKit
import React
import RoomPlan

@objc(ARRoomScanner)
class ARRoomScanner: NSObject {

  private var resolver: RCTPromiseResolveBlock?
  private var rejecter: RCTPromiseRejectBlock?

  @objc
  func scanRoom(_ resolve: @escaping RCTPromiseResolveBlock,
                rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolver = resolve
    rejecter = reject

    DispatchQueue.main.async {
      let vc = RoomCaptureViewController()
      vc.modalPresentationStyle = .fullScreen

      vc.onFinished = { [weak self] jsonString in
        self?.resolver?(jsonString)
        self?.clearCallbacks()
      }

      vc.onCancelled = { [weak self] in
        self?.rejecter?("CANCELLED", "User cancelled scan", nil)
        self?.clearCallbacks()
      }

      if let root = RCTPresentedViewController() {
        root.present(vc, animated: true, completion: nil)
      }
    }
  }

  private func clearCallbacks() {
    resolver = nil
    rejecter = nil
  }
}
