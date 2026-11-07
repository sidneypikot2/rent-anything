// A jet ski's features (RAA-273), the API's fixed list in the jet ski category's schema, in the
// order the partner form and the guest chips show them.
export const JET_SKI_FEATURE_LABELS: Record<string, string> = {
  reverse_gear: "Reverse gear",
  braking_system: "Brakes",
  cruise_control: "Cruise control",
  no_wake_mode: "No-wake mode",
  boarding_step: "Boarding step",
  waterproof_storage: "Waterproof storage",
  bluetooth_audio: "Bluetooth audio",
  tow_hook: "Tow hook",
};

export const JET_SKI_FEATURES = Object.keys(JET_SKI_FEATURE_LABELS);

// Suggested in the partner form; any other brand can be typed.
export const JET_SKI_BRANDS = ["Yamaha", "Sea-Doo", "Kawasaki", "Honda"];
