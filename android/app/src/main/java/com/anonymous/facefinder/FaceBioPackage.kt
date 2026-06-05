package com.anonymous.facefinder

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

import android.util.Log

class FaceBioPackage : ReactPackage {
  init {
    Log.w("FaceBioPackage", "FaceBioPackage: constructor invoked!")
  }

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    Log.w("FaceBioPackage", "FaceBioPackage: createNativeModules invoked!")
    return listOf(FaceBioModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
