// ModelViewer.jsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// CONFIG: Conversational Responses (Static)
const conversationalResponses = {
  openHouseDoor: [
    "I'll get that house door for you.",
    "Opening the house door now.",
    "Consider the house door opened!",
    "Letting some fresh air in.",
    "Access granted. House door opening."
  ],
  closeHouseDoor: [
    "Closing the house door.",
    "Securing the house door.",
    "Shutting the house door tight.",
    "Blocking out the draft.",
    "House door is now closed."
  ],
  openCarDoor: [
    "Unlocking and opening the car door.",
    "Car door coming open.",
    "Getting the car ready for you.",
    "Popping the car door open."
  ],
  closeCarDoor: [
    "Closing the car door.",
    "Shutting the car door.",
    "Car door secure.",
    "Locked and loaded. Car door closed."
  ],
  enableLight: [
    "Let there be light!",
    "Lights on.",
    "Illuminating the area.",
    "Switching on the street lights.",
    "Brightening things up."
  ],
  disableLight: [
    "Lights out.",
    "Going dark.",
    "Turning off the street lights.",
    "Saving energy, lights off.",
    "Fade to black."
  ],
  changeColor: [
    "Changing the mood to {color}.",
    "{color} it is!",
    "Painting it {color}.",
    "Switching to a nice shade of {color}.",
    "One {color} light, coming right up."
  ],
  sunrise: [
    "Good morning! Rise and shine.",
    "Here comes the sun.",
    "Starting a brand new day.",
    "Sunrise mode activated.",
    "Waking up the world."
  ],
  sunset: [
    "Setting the mood for the evening.",
    "The sun is going down.",
    "Enjoy the sunset.",
    "Relaxing evening vibes activated.",
    "Golden hour is here."
  ],
  day: [
    "Back to broad daylight.",
    "Midday sun activated.",
    "Bright and sunny.",
    "It's a beautiful day.",
    "Full daylight mode."
  ],
  greeting: [
    "I'm here and listening.",
    "Ready for your commands.",
    "What can I do for you?",
    "System online and ready.",
    "Hello! How can I help?"
  ]
};

const getRandomResponse = (key, params = {}) => {
  const responses = conversationalResponses[key];
  if (!responses) return "I'm not sure what to say to that.";
  let response = responses[Math.floor(Math.random() * responses.length)];

  // Replace placeholders like {color}
  Object.keys(params).forEach(param => {
    response = response.replace(`{${param}}`, params[param]);
  });

  return response;
};

const ModelViewer = () => {
  const mountRef = useRef(null);
  const selectedObjectRef = useRef(null);
  const [selectedName, setSelectedName] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false); // UI feedback
  const [isListening, setIsListening] = useState(false); // Avatar feedback
  // Removed dynamic avatarImage state, using constant idle image with CSS animation
  // LIP SYNC STATE (Single Image Mode)
  const avatarImage = process.env.PUBLIC_URL + "/ai_avatar_idle.png";
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null); // Chrome GC Fix




  // INJECT CSS FOR PULSE ANIMATION
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes talkPulse {
        0% { transform: scale(1); filter: brightness(1); }
        25% { transform: scale(1.05); filter: brightness(1.1); }
        50% { transform: scale(1); filter: brightness(1); }
        75% { transform: scale(1.05); filter: brightness(1.1); }
        100% { transform: scale(1); filter: brightness(1); }
      }
      @keyframes listenGlow {
        0% { box-shadow: 0 0 10px #00ff41; border-color: rgba(0,255,65,0.5); }
        50% { box-shadow: 0 0 25px #00ff41, 0 0 15px #00ff41 inset; border-color: rgba(0,255,65,1); }
        100% { box-shadow: 0 0 10px #00ff41; border-color: rgba(0,255,65,0.5); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    // AI VOICE ASSISTANT
    const speak = (text) => {
      const synth = window.speechSynthesis;
      if (!synth) return;

      // Cancel previous to prevent stuck queue
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.pitch = 1.0;
      utter.rate = 1.0;
      utter.volume = 1.0;

      // Store ref to prevent Garbage Collection (Critical Chrome Fix)
      utteranceRef.current = utter;

      utter.onstart = () => {
        console.log("🔊 STARTED SPEAKING:", text);
        setIsSpeaking(true);
      };

      utter.onend = () => {
        console.log("✅ FINISHED SPEAKING");
        setIsSpeaking(false);
      };

      utter.onerror = (e) => {
        console.error("❌ SPEECH ERROR:", e);
        setIsSpeaking(false);
      };

      let voices = synth.getVoices();
      if (voices.length === 0) {
        console.warn("⚠️ No voices loaded yet, but speaking anyway.");
      } else {
        // Voice Preference List (Prioritize high quality / natural voices)
        const preferredVoices = [
          "Google US English",
          "Samantha", // Mac standard high quality
          "Ava",      // Mac Premium
          "Allison",  // Mac Premium
          "Tom",      // Mac Premium
          "Microsoft Zira",
          "Microsoft David"
        ];

        let selectedVoice = null;

        // 1. Try to find a preferred voice
        for (const name of preferredVoices) {
          selectedVoice = voices.find(v => v.name.includes(name));
          if (selectedVoice) break;
        }

        // 2. Fallback to any English voice
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.startsWith("en"));
        }

        if (selectedVoice) {
          utter.voice = selectedVoice;
          console.log("🗣️ Selected Voice:", selectedVoice.name);

          // Optional: Slight randomization for "human" feel? 
          // keeping it subtle or 1.0 for clarity for now.
          // utter.pitch = 0.9 + Math.random() * 0.2; 
        }
      }

      synth.speak(utter);

      // Chrome 'resume' hack
      if (synth.paused) synth.resume();
    };

    //-------------------------------------------------
    // SCENE
    //-------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222233);

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000
    );
    camera.position.set(5, 5, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    //-------------------------------------------------
    // CONTROLS
    //-------------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    //-------------------------------------------------
    // LIGHTS
    //-------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    const sunLight = new THREE.DirectionalLight(0xffffff, 2);
    sunLight.position.set(10, 20, 10);

    const nightLight = new THREE.DirectionalLight(0x444466, 0.3);
    nightLight.position.set(5, 20, -5);
    nightLight.visible = false;

    scene.add(ambientLight, sunLight, nightLight);

    //-------------------------------------------------
    // STREET LIGHT
    //-------------------------------------------------
    const streetLight = new THREE.PointLight(0xfff2cc, 0, 20);
    scene.add(streetLight);

    //-------------------------------------------------
    // SUN MESH (Visual Representation)
    //-------------------------------------------------
    const sunGeo = new THREE.SphereGeometry(2, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(10, 20, 10); // Default Day pos
    scene.add(sunMesh);
    streetLight.position.set(0, 5, 0);
    streetLight.intensity = 0;
    scene.add(streetLight);

    //-------------------------------------------------
    // WEATHER CONTAINERS
    //-------------------------------------------------
    let rainSystem = null;
    let snowSystem = null;
    let leavesSystem = null;

    //-------------------------------------------------
    // LOAD MODEL
    //-------------------------------------------------
    const loader = new GLTFLoader();
    loader.load(
      "/pink-bedroom.glb", // verify path
      (gltf) => {
        const model = gltf.scene;
        model.name = "HouseModel"; // Anchor for logic
        scene.add(model);
        console.log("MODEL LOADED:", model);

        //-------------------------------------------------
        // RENAME OBJECTS (Strict User Request)
        //-------------------------------------------------
        let chairCount = 0;
        let beanbagCount = 0;

        model.traverse((child) => {
          if (!child.isMesh) return;
          const low = child.name.toLowerCase();

          // Standardize names (Unique)
          if (low.includes("chair")) {
            chairCount++;
            // SWAP: User wants 2nd chair (Brown) to be main "chair"
            if (chairCount === 2) child.name = "chair";
            else if (chairCount === 1) child.name = "chair2";
            else child.name = `chair${chairCount}`;
          }
          if (low.includes("bean")) {
            beanbagCount++;
            child.name = beanbagCount === 1 ? "beanbag" : `beanbag${beanbagCount}`;
          }
          if (low.includes("lamp") || low.includes("street")) child.name = "streetLightMesh";
        });

        //-------------------------------------------------
        // FIX HOUSE DOOR PIVOT -> "houseDoor"
        //-------------------------------------------------
        const housePivot = model.getObjectByName("Door");
        if (housePivot) {
          // USER REQUEST: Rename pivot to "houseDoor"
          housePivot.name = "houseDoor";

          // Rename children to avoid confusion, but main target is pivot
          housePivot.children.forEach((c) => {
            if (c.isMesh) {
              c.name = "houseDoorMesh";
              c.userData.pivot = housePivot; // Link mesh to pivot
            }
          });
        }

        //-------------------------------------------------
        // FIX CAR DOOR + FIND CAR ROOT -> "Car Door" pivot becomes "carDoor"
        //-------------------------------------------------
        // Find existing car door mesh (Robust Search)
        let originalCarDoorMesh = null;
        model.traverse((child) => {
          if (originalCarDoorMesh) return; // already found
          if (!child.isMesh) return;
          const n = child.name.toLowerCase().trim();
          if (n === "car_door" || n === "car door" || n === "cardoor") {
            originalCarDoorMesh = child;
          }
        });



        if (originalCarDoorMesh) {
          console.log("FOUND CAR DOOR MESH:", originalCarDoorMesh);

          // 1. Create a PIVOT GROUP to act as the Hinge
          const pivotGroup = new THREE.Group();
          pivotGroup.name = "cardoor"; // The Target Name for Voice

          const parent = originalCarDoorMesh.parent;
          if (parent) {
            parent.add(pivotGroup);
          }

          // 2. Initial Transform Copy
          pivotGroup.position.copy(originalCarDoorMesh.position);
          // pivotGroup.rotation.copy(originalCarDoorMesh.rotation); // FORCE VERTICAL AXIS
          pivotGroup.scale.copy(originalCarDoorMesh.scale);
          const originalRotation = originalCarDoorMesh.rotation.clone();

          // 3. Calculate Offset for Hinge (Front Edge)
          originalCarDoorMesh.geometry.computeBoundingBox();
          const bb = originalCarDoorMesh.geometry.boundingBox;
          const size = new THREE.Vector3();
          bb.getSize(size);
          const center = new THREE.Vector3();
          bb.getCenter(center);

          // ASSUMPTION: Car faces -Z, so Front is min.z (or max.z depending on model origin)
          // Adjusting Pivot to be at the "Front" edge of the door mesh
          // Local Offset: Move pivot forward (or back) by half the width/length
          // Trying typical setup: Shift Pivot to +Z edge (or -Z)
          // Let's assume standard door geometry is centered.
          // ASSUMPTION: Car faces -Z. Front is min.z.
          // Using Bounding Box Min Z for precise edge detection (Handles non-centered origins)
          const hingeOffset = bb.min.z;

          // Move Pivot to Hinge (Front Edge)
          pivotGroup.translateZ(hingeOffset);

          // 4. Parent Mesh to Pivot
          pivotGroup.add(originalCarDoorMesh);

          // 5. Reset Mesh Transform relative to Pivot
          originalCarDoorMesh.position.set(0, 0, 0);
          originalCarDoorMesh.rotation.copy(originalRotation);
          originalCarDoorMesh.scale.set(1, 1, 1);

          // 6. Apply Inverse Offset
          // Pivot moved +hingeOffset. Mesh must move -hingeOffset relative to Pivot.
          originalCarDoorMesh.position.z -= hingeOffset;

          // Rename mesh so we don't double-select
          originalCarDoorMesh.name = "carDoorMesh";

          // Find Parent Car Group to allow moving the whole car
          let carParent = parent;

          // SETUP CAR ROOT (Just naming, NO MOVING)
          if (carParent) {
            carParent.name = "CarBody";
          }
        }

        //-------------------------------------------------
        // STREET LIGHT TARGET MESH POSITION
        //-------------------------------------------------
        const lampMesh = model.getObjectByName("streetLightMesh");
        if (lampMesh) {
          streetLight.position.set(
            lampMesh.position.x,
            lampMesh.position.y + 4,
            lampMesh.position.z
          );
        }
      },
      undefined,
      (err) => console.error("LOAD ERROR:", err)
    );

    //-------------------------------------------------
    // RAYCASTING
    //-------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(scene.children, true);

      if (hits.length > 0) {
        const obj = hits[0].object;
        selectedObjectRef.current = obj;
        setSelectedName(obj.name);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    //-------------------------------------------------
    // ANIM FUNCTIONS
    //-------------------------------------------------
    //-------------------------------------------------
    // ANIMATION UTILS (Fixed Timing + Axis Support)
    //-------------------------------------------------
    const smoothMove = (obj, axis, dist) => {
      if (!obj) return;
      console.log(`Moving ${obj.name} on ${axis} by ${dist}`);
      const start = obj.position[axis];
      const end = start + dist;

      let startTime = null;
      const duration = 500;

      const anim = (time) => {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        const p = Math.min(elapsed / duration, 1);
        const ease = p * (2 - p); // Ease out quad

        obj.position[axis] = THREE.MathUtils.lerp(start, end, ease);

        if (p < 1) requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    };

    const smoothRotate = (obj, axis, targetAngle) => {
      if (!obj) return;
      console.log(`Rotating ${obj.name} on ${axis} to ${targetAngle}`);

      const start = obj.rotation[axis];
      let startTime = null;
      const duration = 800;

      const anim = (time) => {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        const p = Math.min(elapsed / duration, 1);
        const ease = p * (2 - p);

        obj.rotation[axis] = THREE.MathUtils.lerp(start, targetAngle, ease);

        if (p < 1) requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    };

    const moveCar = (dist) => {
      // Move 'CarBody' so the whole car moves (including door pivot child)
      const car = scene.getObjectByName("CarBody");

      if (!car) {
        console.warn("CarBody not found");
        return;
      }

      console.log(`Moving CAR BODY by ${dist}`);
      const startPos = car.position.clone();

      // Calculate Forward Vector based on Car's Rotation
      // Assuming standard Forward is -Z for the model
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyEuler(car.rotation);

      const target = startPos.clone().add(forward.multiplyScalar(dist));

      let startTime = null;
      const duration = 500;

      const anim = (time) => {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        const p = Math.min(elapsed / duration, 1);
        const ease = p * (2 - p);
        car.position.lerpVectors(startPos, target, ease);
        if (p < 1) requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    };

    //-------------------------------------------------
    // WEATHER FUNCTIONS
    //-------------------------------------------------
    //-------------------------------------------------
    // CLOUDS SYSTEM
    //-------------------------------------------------
    let cloudGroup = null;
    const addClouds = () => {
      if (cloudGroup) return; // Already exists
      cloudGroup = new THREE.Group();

      const cloudGeo = new THREE.SphereGeometry(1, 16, 16);
      const cloudMat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        flatShading: true
      });

      // Create 5 random clouds
      for (let i = 0; i < 5; i++) {
        const cloud = new THREE.Group();
        // Random cluster
        for (let j = 0; j < 3 + Math.random() * 3; j++) {
          const puff = new THREE.Mesh(cloudGeo, cloudMat);
          puff.position.set(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 1,
            (Math.random() - 0.5) * 2
          );
          const scale = 1 + Math.random();
          puff.scale.set(scale, scale, scale);
          puff.rotation.z = Math.random() * Math.PI;
          cloud.add(puff);
        }
        // Position cloud high up
        cloud.position.set(
          (Math.random() - 0.5) * 80, // Wide spread
          25 + Math.random() * 10,    // High up
          (Math.random() - 0.5) * 60 - 20 // Back mostly
        );
        cloudGroup.add(cloud);
      }
      scene.add(cloudGroup);
    };

    const clearClouds = () => {
      if (cloudGroup) {
        scene.remove(cloudGroup);
        cloudGroup = null;
      }
    };

    //-------------------------------------------------
    // REALISTIC WEATHER FUNCTIONS
    //-------------------------------------------------
    const clearWeather = () => {
      scene.fog = null;
      if (rainSystem) {
        scene.remove(rainSystem);
        rainSystem.geometry.dispose();
        rainSystem.material.dispose();
        rainSystem = null;
      }
      if (snowSystem) {
        scene.remove(snowSystem);
        snowSystem.geometry.dispose();
        snowSystem.material.dispose();
        snowSystem = null;
      }
      if (leavesSystem) {
        scene.remove(leavesSystem);
        leavesSystem.geometry.dispose();
        leavesSystem.material.dispose();
        leavesSystem = null;
      }
      // Note: Clouds persist unless manually cleared or rain clears them?
      // Let's clear clouds on "clear" command via voice, but not here implicitly if we want clouds in rain.
      // Actually, let's keep weather clearing simple:
      clearClouds();
    };

    // ... (rest of weather functions)

    // ... inside voice command handler ...



    const addRain = () => {
      clearWeather();
      scene.fog = new THREE.FogExp2(0x11111f, 0.02);
      const count = 3000;
      const geo = new THREE.BufferGeometry();
      const pos = [];
      for (let i = 0; i < count; i++) {
        pos.push((Math.random() - 0.5) * 40);
        pos.push(Math.random() * 20);
        pos.push((Math.random() - 0.5) * 40);
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.2,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });
      rainSystem = new THREE.Points(geo, mat);
      scene.add(rainSystem);
    };

    const addSnow = () => {
      clearWeather();
      scene.fog = new THREE.FogExp2(0xeeeeff, 0.015);
      const count = 3000;
      const geo = new THREE.BufferGeometry();
      const pos = [];
      for (let i = 0; i < count; i++) {
        pos.push((Math.random() - 0.5) * 40);
        pos.push(Math.random() * 20);
        pos.push((Math.random() - 0.5) * 40);
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.15,
        transparent: true,
        opacity: 0.8
      });
      snowSystem = new THREE.Points(geo, mat);
      scene.add(snowSystem);
    };

    const addLeaves = () => {
      clearWeather();
      const count = 500;
      const geo = new THREE.BufferGeometry();
      const pos = [];
      for (let i = 0; i < count; i++) {
        pos.push((Math.random() - 0.5) * 30);
        pos.push(Math.random() * 15);
        pos.push((Math.random() - 0.5) * 30);
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xd45079,
        size: 0.25,
        transparent: true,
      });
      leavesSystem = new THREE.Points(geo, mat);
      scene.add(leavesSystem);
    };

    //-------------------------------------------------
    // VOICE COMMANDS
    //-------------------------------------------------
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    recognitionRef.current = rec;

    // REC LIFECYCLE FOR AVATAR
    rec.onstart = () => {
      console.log("🎤 Voice Recognition Started");
      setIsListening(true);
    };

    rec.onend = () => {
      console.log("🛑 Voice Recognition Stopped");
      setIsListening(false);
      // Auto-restart for continuous listening
      try { rec.start(); } catch (e) { }
    };
    rec.onerror = (e) => console.warn("Voice error:", e.error);

    //-------------------------------------------------
    // AI VOICE LOGIC (Project-Ready)
    //-------------------------------------------------
    /**
     * 🔮 AI Voice Assistant Prompt
     * “You are an AI voice assistant for a 3D interactive environment.
     * Your job is to listen to natural human voice commands and convert them into actions.
     * 
     * You must:
     * – Recognize object names like house door, car door, chair, street light
     * – Understand actions like open, close, move, turn on, turn off
     * – Execute smooth, realistic animations
     */

    const openHouseDoor = () => {
      const houseDoor = scene.getObjectByName("houseDoor");
      if (houseDoor) {
        smoothRotate(houseDoor, 'z', Math.PI / 2);
        speak(getRandomResponse("openHouseDoor"));
      }
    };

    const closeHouseDoor = () => {
      const houseDoor = scene.getObjectByName("houseDoor");
      if (houseDoor) {
        smoothRotate(houseDoor, 'z', 0);
        speak(getRandomResponse("closeHouseDoor"));
      }
    };

    const openCarDoor = () => {
      const carDoor = scene.getObjectByName("cardoor");
      if (carDoor) {
        smoothRotate(carDoor, 'y', Math.PI / 3);
        speak(getRandomResponse("openCarDoor"));
      }
    };

    const closeCarDoor = () => {
      const carDoor = scene.getObjectByName("cardoor");
      if (carDoor) {
        smoothRotate(carDoor, 'y', 0);
        speak(getRandomResponse("closeCarDoor"));
      }
    };

    const enableLight = () => {
      streetLight.intensity = 15;
      speak(getRandomResponse("enableLight"));
    };

    const disableLight = () => {
      streetLight.intensity = 0;
      speak(getRandomResponse("disableLight"));
    };

    const changeLightColor = (color, name) => {
      streetLight.color.set(color);
      streetLight.intensity = 15; // Ensure it's on
      speak(getRandomResponse("changeColor", { color: name }));
    };
    const changeObjectColor = (targetName, color, colorName) => {
      const obj = scene.getObjectByName(targetName);
      if (obj) {
        // Traverse to find meshes and update material
        obj.traverse((child) => {
          if (child.isMesh) {
            child.material = child.material.clone(); // Clone to ensure unique
            child.material.color.set(color);
          }
        });
        speak(getRandomResponse("changeColor", { color: colorName }));
      } else {
        speak(`I can't find the ${targetName}`);
      }
    };
    rec.onresult = (e) => {
      const resultsLength = e.results.length;
      const cmd = e.results[resultsLength - 1][0].transcript.toLowerCase().trim();
      console.log("VOICE RECEIVED:", cmd);

      // 0. HELP COMMAND
      // 0. HELP COMMAND
      if (cmd.includes("help") || cmd.includes("what can you do") || cmd.includes("instructions")) {
        speak(getRandomResponse("greeting") + " Try saying 'Open car door', 'Make it rain', 'Sunset', or 'Turn on street lights'.");
        return; // Skip other checks
      }

      // 🛠 MINIMAL CODE PROMPT (Voice Parsing Logic)

      // 🚪 DOORS
      if (cmd.includes("open") && cmd.includes("house door")) openHouseDoor();
      else if (cmd.includes("open") && cmd.includes("door") && !cmd.includes("car")) openHouseDoor(); // Fallback

      if (cmd.includes("close") && cmd.includes("house door")) closeHouseDoor();
      else if (cmd.includes("close") && cmd.includes("door") && !cmd.includes("car")) closeHouseDoor(); // Fallback

      if (cmd.includes("open") && (cmd.includes("car door") || cmd.includes("cardoor"))) openCarDoor();
      if (cmd.includes("close") && (cmd.includes("car door") || cmd.includes("cardoor"))) closeCarDoor();

      // 💡 LIGHTING
      if (cmd.includes("turn on") && (cmd.includes("light") || cmd.includes("street"))) enableLight();
      if (cmd.includes("turn off") && (cmd.includes("light") || cmd.includes("street"))) disableLight();

      if (cmd.includes("light") && cmd.includes("red")) changeLightColor(0xff0000, "Red");
      if (cmd.includes("light") && cmd.includes("blue")) changeLightColor(0x0000ff, "Blue");
      if (cmd.includes("light") && cmd.includes("green")) changeLightColor(0x00ff00, "Green");
      if (cmd.includes("light") && (cmd.includes("yellow") || cmd.includes("warm"))) changeLightColor(0xffff00, "Yellow");
      if (cmd.includes("light") && cmd.includes("white")) changeLightColor(0xffffff, "White");
      if (cmd.includes("light") && cmd.includes("purple")) changeLightColor(0x800080, "Purple");
      if (cmd.includes("light") && cmd.includes("pink")) changeLightColor(0xffc0cb, "Pink");
      if (cmd.includes("light") && cmd.includes("orange")) changeLightColor(0xffa500, "Orange");

      // 🎨 OBJECT COLORS
      // Helper to identify color commands
      const checkColor = (colorHex, colorName) => {
        if (cmd.includes("chair") && cmd.includes(colorName.toLowerCase())) changeObjectColor("chair", colorHex, colorName);
        if (cmd.includes("beanbag") && cmd.includes(colorName.toLowerCase())) changeObjectColor("beanbag", colorHex, colorName);
        if (cmd.includes("car") && cmd.includes(colorName.toLowerCase()) && !cmd.includes("door")) changeObjectColor("cardoor", colorHex, colorName); // cardoor group acts as car body often
      };

      checkColor(0xff0000, "Red");
      checkColor(0x0000ff, "Blue");
      checkColor(0x00ff00, "Green");
      checkColor(0xffff00, "Yellow");
      checkColor(0xffffff, "White");
      checkColor(0x800080, "Purple");
      checkColor(0xffc0cb, "Pink");
      checkColor(0xffa500, "Orange");
      checkColor(0x000000, "Black");

      // 🪑 OBJECTS (Chair/Beanbag)
      let targetName = "";
      if (cmd.includes("chair")) targetName = "chair";
      else if (cmd.includes("beanbag")) targetName = "beanbag";

      let moveTarget = targetName ? scene.getObjectByName(targetName) : null;
      if (moveTarget && cmd.includes("move")) {
        const speed = 0.5; // Restored to original speed
        console.log(`Command: Move ${moveTarget.name}`);

        if (cmd.includes("left")) { smoothMove(moveTarget, "x", -speed); speak(`Moving ${targetName} left`); }
        if (cmd.includes("right")) { smoothMove(moveTarget, "x", speed); speak(`Moving ${targetName} right`); }
        if (cmd.includes("forward")) { smoothMove(moveTarget, "z", -speed); speak(`Moving ${targetName} forward`); }
        if (cmd.includes("back")) { smoothMove(moveTarget, "z", speed); speak(`Moving ${targetName} back`); }

        // Select it for visual feedback too
        selectedObjectRef.current = moveTarget;
        setSelectedName(moveTarget.name);
      }





      // --- WEATHER & TIME OF DAY ---

      // SUNRISE
      if (cmd.includes("sunrise") || (cmd.includes("sun") && cmd.includes("rise"))) {
        console.log("Setting SUNRISE");
        scene.background = new THREE.Color(0xffdcae); // Morning Peach
        ambientLight.intensity = 0.6;

        sunLight.color.setHex(0xffaa00);
        sunLight.intensity = 1.0;
        sunLight.position.set(60, 10, 10); // Far away
        sunLight.visible = true;

        // Visual Sun
        sunMesh.visible = true;
        sunMesh.material.color.setHex(0xffaa00);
        sunMesh.position.set(60, 10, 10);

        nightLight.visible = false;
        streetLight.intensity = 0;
        addClouds();
        speak(getRandomResponse("sunrise"));
      }

      // SUNSET
      else if (cmd.includes("sunset") || (cmd.includes("sun") && cmd.includes("set"))) {
        console.log("Setting SUNSET");
        scene.background = new THREE.Color(0xfd5e53); // Sunset Orange/Red
        ambientLight.intensity = 0.5;

        sunLight.color.setHex(0xff4500);
        sunLight.intensity = 0.8;
        sunLight.position.set(-60, 10, 10); // Far away
        sunLight.visible = true;

        // Visual Sun
        sunMesh.visible = true;
        sunMesh.material.color.setHex(0xff4500);
        sunMesh.position.set(-60, 10, 10);

        nightLight.visible = false;
        streetLight.intensity = 5;
        addClouds();
        speak(getRandomResponse("sunset"));
      }

      // DAY
      else if (cmd.includes("day") || cmd.includes("noon") || (cmd.includes("sun") && !cmd.includes("set") && !cmd.includes("rise"))) {
        console.log("Setting DAY");
        scene.background = new THREE.Color(0x87ceeb); // Bright Blue
        ambientLight.intensity = 1.0;

        sunLight.color.setHex(0xffffff);
        sunLight.intensity = 2.0;
        sunLight.position.set(20, 60, 20); // High up
        sunLight.visible = true;

        // Visual Sun
        sunMesh.visible = true;
        sunMesh.material.color.setHex(0xffff00);
        sunMesh.position.set(20, 60, 20);

        nightLight.visible = false;
        streetLight.intensity = 0;
        addClouds();
        speak("It's a bright sunny day!");
      }

      // NIGHT / MOON
      else if (cmd.includes("night") || cmd.includes("moon")) {
        console.log("Setting NIGHT/MOON");
        scene.background = new THREE.Color(0x0a0a12);
        ambientLight.intensity = 0.2;
        sunLight.visible = false;

        // Hide Sun for night
        sunMesh.visible = false;

        nightLight.visible = true;
        streetLight.intensity = 15;
        speak("Good night! Switching to night mode.");
      }

      // WEATHER PARTICLES
      if (cmd.includes("rain")) {
        addRain();
        // Realistic Rain Lighting
        scene.background = new THREE.Color(0x11111f); // Dark Stormy Blue
        ambientLight.intensity = 0.3; // Dim ambient
        sunLight.visible = false;     // Hide direct sun
        sunMesh.visible = false;      // Hide visible sun sphere
        streetLight.intensity = 20;   // Turn on street lights for visibility

        addClouds(); // Add clouds for overcast look

        speak("Making it rain with storm lighting!");
      }
      if (cmd.includes("winter") || cmd.includes("snow")) {
        addSnow();
        sunMesh.visible = false; // Hide sun in snow
        speak("Let it snow!");
      }
      if (cmd.includes("summer")) {
        scene.background = new THREE.Color(0x87ceeb);
        clearWeather();
        sunLight.intensity = 2.5;
        sunLight.visible = true;
        sunMesh.visible = true; // Show sun
        sunMesh.position.set(10, 25, 10); // High summer sun
        sunMesh.material.color.setHex(0xffffaa);
        speak("Summer time!");
      }
      if (cmd.includes("spring")) {
        addLeaves();
        speak("Spring leaves are falling!");
      }
      if (cmd.includes("stop") || cmd.includes("clear")) {
        clearWeather();
        speak("Clearing the weather.");
      }

      // MOVEMENT
      if (cmd.includes("car") && cmd.includes("move")) {
        if (cmd.includes("forward")) moveCar(2);
        if (cmd.includes("back")) moveCar(-2);
      }

      // REMOVE / DELETE
      if (cmd.includes("delete") || cmd.includes("remove")) {
        let removeTarget = selectedObjectRef.current;
        // Try to find target if not selected
        if (!removeTarget) {
          if (cmd.includes("chair")) removeTarget = scene.getObjectByName("chair");
          if (cmd.includes("beanbag")) removeTarget = scene.getObjectByName("beanbag");
        }

        if (removeTarget && (removeTarget.name === "chair" || removeTarget.name === "beanbag")) {
          scene.remove(removeTarget);
          speak(`Removing the ${removeTarget.name}`);

          // Clear selection if we deleted it
          if (selectedObjectRef.current === removeTarget) {
            selectedObjectRef.current = null;
            setSelectedName("");
          }
        } else {
          speak("I can't remove that object.");
        }
      }
    };

    //-------------------------------------------------
    // START VOICE
    //-------------------------------------------------
    document.getElementById("voice-start-btn").onclick = () => {
      rec.start();
      speak("Hello! I am your 3D Assistant. You can ask me to open doors, change the weather, or control the lights.");
    };

    //-------------------------------------------------
    // RENDER LOOP (Improved Animation)
    //-------------------------------------------------
    let frameId;
    const loop = () => {
      controls.update();

      // Animate Rain
      if (rainSystem) {
        const positions = rainSystem.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] -= 0.6; // Speed up rain
          if (positions[i] < 0) positions[i] = 20;
        }
        rainSystem.geometry.attributes.position.needsUpdate = true;
      }

      // Animate Snow (Swaying)
      if (snowSystem) {
        const positions = snowSystem.geometry.attributes.position.array;
        const time = Date.now() * 0.001;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] -= 0.05;
          positions[i] += Math.sin(time + positions[i + 1]) * 0.02; // Gentle Sway
          if (positions[i + 1] < 0) {
            positions[i + 1] = 20;
            positions[i] = (Math.random() - 0.5) * 40;
          }
        }
        snowSystem.geometry.attributes.position.needsUpdate = true;
      }

      // Animate Leaves
      if (leavesSystem) {
        const positions = leavesSystem.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += 0.04;
          positions[i + 1] -= 0.03;
          if (positions[i + 1] < 0) {
            positions[i + 1] = 20;
            positions[i] = (Math.random() - 0.5) * 30;
          }
        }
        leavesSystem.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(loop);
    };
    loop();

    //-------------------------------------------------
    // CLEANUP
    //-------------------------------------------------
    return () => {
      rec.onend = null;
      rec.stop();
      cancelAnimationFrame(frameId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <button
        id="voice-start-btn"
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          padding: "10px 20px",
          background: "#ff80c0",
          color: "white",
          border: "none",
          borderRadius: "10px",
          zIndex: 99
        }}
      >
        🎤 Start Voice
      </button>

      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {isSpeaking && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            padding: "10px 20px",
            background: "#20b2aa",
            color: "white",
            borderRadius: "5px",
            fontFamily: "Arial, sans-serif",
            zIndex: 99,
            boxShadow: "0 0 10px rgba(0,0,0,0.2)",
          }}
        >
          🔊 AI Speaking...
        </div>
      )}

      {selectedName && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "10px",
            zIndex: 99
          }}
        >
          ❤️ Selected: <strong>{selectedName}</strong>
        </div>
      )}
      {/* AI AVATAR OVERLAY */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          width: "180px",
          height: "180px",
          zIndex: 100,
          borderRadius: "50%",
          // Use CSS animation for listening glow
          animation: isListening && !isSpeaking ? "listenGlow 1.5s infinite ease-in-out" : "none",
          border: isListening ? "4px solid #00ff41" : "4px solid rgba(255,255,255,0.2)",
          boxShadow: isListening ? "0 0 25px #00ff41, 0 0 10px #00ff41 inset" : "none",
          transition: "all 0.3s ease",
          overflow: "hidden",
          background: "rgba(0,10,20,0.8)", // Cyberpunk dark bg
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <img
          src={avatarImage}
          alt="AI Avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // Apply Pulse Animation when speaking
            animation: isSpeaking ? "talkPulse 0.3s infinite ease-in-out" : "none",
          }}
        />
        {/* Listening Indicator Text (Optional) */}
        {isListening && !isSpeaking && (
          <div style={{
            position: "absolute",
            bottom: 10,
            fontSize: "12px",
            color: "#00ff41",
            fontWeight: "bold",
            textShadow: "0 0 5px black"
          }}>
            LISTENING...
          </div>
        )}
      </div>
    </div >
  );
};

export default ModelViewer;