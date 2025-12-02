1\. CREATING THE BUILD  
npx expo prebuild  
update following line ‘15.1’ to ‘16.0’ in the one that says Podfile in the ios build folder

- platform :ios, podfile\_properties\['ios.deploymentTarget'\] || '15.1'

run cd ios && xed HeydayMobile.xcworkspace

2\. UPDATING BUILD TO INCLUDE AR COMPONENT  
right click topmost HeydayMobile with the blue build tool and do “new group” and name it RoomPlan  
Follow steps to add the following files from this link into that folder: [https://github.com/edwardzke/heyday/tree/integrateRoomPlanAPI/HeydayMobile/ios/RoomPlan](https://github.com/edwardzke/heyday/tree/integrateRoomPlanAPI/HeydayMobile/ios/RoomPlan)

1. Right click the RoomPlan group and click “New File from Template”  
2. For the swift files do Swift, for the .m files do (Objective-C)  
3. Use the same file names when doing Save As and make sure “HeyDay Mobile” is clicked under the dependencies or whatever  
4. Copy and paste the code for the resp file

3\. UPDATING BRIDGING HEADER SO IT ACTUALLY WORKS  
Follow steps to add this file: [https://github.com/edwardzke/heyday/blob/integrateRoomPlanAPI/HeydayMobile/ios/HeydayMobile/HeydayMobile-Bridging-Header.h](https://github.com/edwardzke/heyday/blob/integrateRoomPlanAPI/HeydayMobile/ios/HeydayMobile/HeydayMobile-Bridging-Header.h) 

1. In the first HeydayMobile folder under the original blue build tool group find the HeydayMobile-Bridging-Header.h and copy and paste that in

4\. UPDATE THE BUILD STUFF  
On the outermost blue build tool thing, right click and change minimum deployment to ios 26 in general tab  
Scroll Down to frameworks libraries and embedded content and click on the \+ button. Add the RoomPlan.framework from Apple SDK. Make sure it’s Do Not Embed  
Under signing & capabilities select your team (if you don’t have one you have to make one look it up on youtube)  
Create new bundle identifier, literally anything works

5\. UPDATE THE REACT SIDE TO USE WHAT WE JUST DID

1. Add the following file as a page: roomscan.tsx: [https://github.com/edwardzke/heyday/blob/integrateRoomPlanAPI/HeydayMobile/app/roomscan.tsx](https://github.com/edwardzke/heyday/blob/integrateRoomPlanAPI/HeydayMobile/app/roomscan.tsx)   
2. Update the dashboard or whatever button we want to route to it so replace /camerapage with /roomscan   
3. 

END

Actually Running:

- Make sure you’re not on eduroam cause it doesn’t work cause of firewall, so hotspot or smth  
- In HeydayMobile/ios run xed HeydayMobile.xcworkspace and build it onto the phone  
  - If build succeeds thats good  
- Go back to expo and run the following  
  - npx expo run:ios \--device

