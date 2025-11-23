#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ARRoomScanner, NSObject)

RCT_EXTERN_METHOD(scanRoom:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
