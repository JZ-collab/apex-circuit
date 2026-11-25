extends VehicleBody3D
class_name RaceCar

## Physics-driven car wrapper around a Sketchfab GLB. Handles normalization,
## deep cosmetic/mechanical customization, lights and a protected reverse shift.

@export var model_path: String = ""
@export var display_name: String = "Car"
@export var author: String = ""
@export var license_name: String = ""
@export var engine_force_max: float = 5200.0
@export var brake_force_max: float = 34.0
@export var mass_kg: float = 1250.0

var gear: int = 1
var rpm: float = 900.0
var speed_kmh: float = 0.0
var reverse: bool = false
var shift_timer: float = 0.0
var nitro: float = 100.0
var boosting: bool = false
var damage: float = 0.0
var engine_name: String = "SPORT"
var paint_color: Color = Color(0.10, 0.72, 1.0)
var rim_color: Color = Color(0.72, 0.76, 0.82)
var rim_style: int = 0
var spoiler_enabled: bool = false
var decal_style: int = 0
var suspension_index: int = 1
var tire_index: int = 1
var final_drive_index: int = 1
var final_drive: float = 3.7
var tire_grip: float = 1.35
var wheels: Array[VehicleWheel3D] = []
var rim_meshes: Array[MeshInstance3D] = []
var spoke_nodes: Array[Node3D] = []
var model_root: Node3D
var cosmetic_root: Node3D
var brake_lights: Array[MeshInstance3D] = []
var flame_lights: Array[MeshInstance3D] = []
var last_collision_speed := 0.0
var suspension_offset := 0.0
var body_top := 1.0
var body_bottom := -0.32
var body_front := -2.175
var body_rear := 2.175

const RATIOS := [3.42, 2.15, 1.52, 1.16, 0.92, 0.74]
const FINAL_DRIVES := [3.20, 3.70, 4.15]
# VehicleWheel3D's default friction slip is 10.5. The old 1.1-1.6 values
# made every car slide on ice and feel impossible to steer.
const TIRE_GRIPS := [7.0, 10.5, 14.0]
const REST_LENGTHS := [0.30, 0.38, 0.46]
const RIDE_OFFSETS := [-0.06, 0.0, 0.07]


func _ready() -> void:
	mass = mass_kg
	# Without a hull shape, RigidBody3D derives a near-zero inertia and the
	# wheel forces launch the car. Supply a realistic box inertia manually.
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, -0.25, 0)
	inertia = Vector3(2200.0, 2400.0, 620.0)
	linear_damp = 0.02
	angular_damp = 0.35
	cosmetic_root = Node3D.new()
	cosmetic_root.name = "Cosmetics"
	add_child(cosmetic_root)
	# A narrow, high hull gives Bullet a chassis for wheel raycasts but stays
	# inside the wheel track so suspension rays cannot hit the car itself.
	var hull := CollisionShape3D.new()
	hull.name = "Hull"
	var hull_box := BoxShape3D.new()
	hull_box.size = Vector3(1.1, 0.22, 3.2)
	hull.shape = hull_box
	hull.position = Vector3(0, 0.55, 0)
	add_child(hull)
	load_model()
	build_wheels()
	build_lights()
	apply_paint(paint_color)
	apply_rims(rim_color, rim_style)
	apply_suspension(suspension_index)
	set_tire(tire_index)
	set_final_drive(final_drive_index)
	rebuild_cosmetics()


func set_model(path: String) -> void:
	if path == model_path and model_root != null and is_instance_valid(model_root):
		apply_paint(paint_color)
		return
	model_path = path
	if model_root != null and is_instance_valid(model_root):
		model_root.queue_free()
		model_root = null
	suspension_offset = 0.0
	load_model()
	apply_paint(paint_color)
	apply_suspension(suspension_index)
	rebuild_cosmetics()


func load_model() -> void:
	if model_path.is_empty():
		return
	var packed: PackedScene = load(model_path)
	if packed == null:
		push_warning("Could not load model: " + model_path)
		return
	if model_root != null and is_instance_valid(model_root):
		model_root.queue_free()
	model_root = Node3D.new()
	model_root.name = "SketchfabBody"
	add_child(model_root)
	var instance := packed.instantiate()
	_strip_baked_wheels(instance)
	model_root.add_child(instance)
	normalize_model(model_root)


func _aabb(node: Node3D) -> AABB:
	var box := AABB(node.global_transform.origin, Vector3.ZERO)
	var first := true
	var stack: Array[Node] = [node]
	while stack.size() > 0:
		var n: Node = stack.pop_back()
		if n is MeshInstance3D:
			var mi := n as MeshInstance3D
			if mi.mesh != null:
				var b := mi.mesh.get_aabb()
				var t := mi.global_transform * b
				if first:
					box = t
					first = false
				else:
					box = box.merge(t)
		for c in n.get_children():
			stack.append(c)
	return box


func _strip_baked_wheels(node: Node) -> void:
	# Drivable wheels are added as VehicleWheel3D nodes with proper suspension.
	# Source models often contain static wheel meshes that then float or clip.
	var doomed: Array[Node] = []
	var stack: Array[Node] = [node]
	while stack.size() > 0:
		var n: Node = stack.pop_back()
		var nname := n.name.to_lower()
		if nname.contains("wheel") or nname.contains("tire") or nname.contains("tyre") or nname.contains("rim"):
			doomed.append(n)
			continue
		for c in n.get_children():
			stack.append(c)
	for n in doomed:
		n.get_parent().remove_child(n)
		n.queue_free()


func normalize_model(root: Node3D) -> void:
	root.transform = Transform3D.IDENTITY
	var box := _aabb(root)
	if box.size.x <= 1e-5 or box.size.z <= 1e-5:
		push_warning("Degenerate car model: " + model_path)
		return
	# Long axis faces forward (-Z in Godot). A 90° yaw also fixes models that
	# were authored facing +X; check the rotated bounds before committing.
	if box.size.x > box.size.z:
		root.rotation.y = PI * 0.5
		var rotated := _aabb(root)
		if rotated.size.z >= rotated.size.x * 0.9:
			box = rotated
		else:
			root.rotation.y = 0.0
	# Source GLBs range from a 0.25 m goblin to a 138 m detailed concept car.
	# A single uniform scale cannot fit both, so fit width and length
	# independently while keeping the vertical scale believable.
	var sx := 1.85 / maxf(box.size.x, 1e-5)
	var sy := 1.35 / maxf(box.size.y, 1e-5)
	var sz := 4.35 / maxf(box.size.z, 1e-5)
	root.scale = Vector3(sx, sy, sz)
	var fitted := _aabb(root)
	root.position = Vector3(
		-fitted.get_center().x,
		-0.30 - fitted.position.y,
		-fitted.get_center().z
	)
	fitted = _aabb(root)
	body_bottom = fitted.position.y
	body_top = fitted.end.y
	body_front = fitted.position.z
	body_rear = fitted.end.z


func _paintable(mat: Material) -> bool:
	if mat == null:
		return true
	var n: String = mat.resource_name.to_lower()
	for skip in ["glass", "window", "windshield", "light", "lamp", "tyre", "tire", "rim", "wheel", "mirror", "plate", "interior", "seat", "chrome"]:
		if n.contains(skip):
			return false
	return true


func apply_paint(color: Color) -> void:
	paint_color = color
	if model_root == null:
		return
	var stack: Array[Node] = [model_root]
	while stack.size() > 0:
		var n: Node = stack.pop_back()
		if n is MeshInstance3D:
			var mi := n as MeshInstance3D
			var count := mi.mesh.get_surface_count() if mi.mesh != null else 0
			for s in count:
				var mat: Material = mi.get_surface_override_material(s)
				if mat == null and mi.mesh != null:
					mat = mi.mesh.surface_get_material(s)
				if mat is StandardMaterial3D and _paintable(mat):
					var m := (mat as StandardMaterial3D).duplicate()
					# Tint rather than replace, so imported detail maps survive.
					m.albedo_color = color
					m.metallic = 0.48
					m.roughness = 0.27
					mi.set_surface_override_material(s, m)
				elif mat == null:
					var m2 := StandardMaterial3D.new()
					m2.albedo_color = color
					m2.metallic = 0.48
					m2.roughness = 0.28
					mi.set_surface_override_material(s, m2)
		for c in n.get_children():
			stack.append(c)
	for light in brake_lights:
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.25, 0.01, 0.01)
		m.emission = Color(1.0, 0.05, 0.02)
		m.emission_energy = 1.2
		light.material_override = m


func build_wheels() -> void:
	var wheel_mat := StandardMaterial3D.new()
	wheel_mat.albedo_color = Color(0.035, 0.038, 0.045)
	wheel_mat.roughness = 0.82
	var rim_mat := StandardMaterial3D.new()
	rim_mat.albedo_color = rim_color
	rim_mat.metallic = 0.9
	rim_mat.roughness = 0.2
	for x in [-0.88, 0.88]:
		for z in [-1.38, 1.38]:
			var w := VehicleWheel3D.new()
			w.name = "Wheel_%s_%s" % [("L" if x < 0 else "R"), ("F" if z < 0 else "R")]
			w.position = Vector3(x, 0.02, z)
			w.wheel_radius = 0.36
			w.wheel_rest_length = REST_LENGTHS[suspension_index]
			# Bullet's wheel spring is tuned for a 40 kg default body. Scale it
			# with the car mass or a 1250 kg car sinks through the road.
			w.suspension_stiffness = mass_kg * 0.15
			w.damping_compression = 0.6
			w.damping_relaxation = 0.8
			w.wheel_friction_slip = tire_grip
			w.wheel_roll_influence = 0.06
			w.use_as_steering = z < 0
			w.use_as_traction = true
			add_child(w)
			wheels.append(w)
			var tyre := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.36
			cyl.bottom_radius = 0.36
			cyl.height = 0.26
			cyl.radial_segments = 16
			cyl.material = wheel_mat
			tyre.mesh = cyl
			tyre.rotation = Vector3(0, 0, PI * 0.5)
			tyre.material_override = wheel_mat
			w.add_child(tyre)
			var rim := MeshInstance3D.new()
			rim.name = "Rim"
			var rc := CylinderMesh.new()
			rc.top_radius = 0.20
			rc.bottom_radius = 0.20
			rc.height = 0.28
			rc.radial_segments = 16
			rc.material = rim_mat
			rim.mesh = rc
			rim.rotation = Vector3(0, 0, PI * 0.5)
			rim.material_override = rim_mat
			w.add_child(rim)
			rim_meshes.append(rim)


func build_lights() -> void:
	for x in [-0.62, 0.62]:
		var head := MeshInstance3D.new()
		var hb := BoxMesh.new()
		hb.size = Vector3(0.34, 0.12, 0.06)
		var hm := StandardMaterial3D.new()
		hm.albedo_color = Color(0.95, 0.97, 1.0)
		hm.emission = Color(0.7, 0.85, 1.0)
		hm.emission_energy = 2.0
		hb.material = hm
		head.mesh = hb
		head.position = Vector3(x, 0.22, -2.12)
		head.material_override = hm
		add_child(head)
		var tail := MeshInstance3D.new()
		var tb := BoxMesh.new()
		tb.size = Vector3(0.34, 0.10, 0.06)
		var tail_mat := StandardMaterial3D.new()
		tail_mat.albedo_color = Color(0.25, 0.01, 0.01)
		tail_mat.emission = Color(1.0, 0.05, 0.02)
		tail_mat.emission_energy = 1.2
		tb.material = tail_mat
		tail.mesh = tb
		tail.position = Vector3(x, 0.20, 2.12)
		tail.material_override = tail_mat
		add_child(tail)
		brake_lights.append(tail)
		var flame := MeshInstance3D.new()
		var fb := BoxMesh.new()
		fb.size = Vector3(0.14, 0.10, 0.5)
		var fm := StandardMaterial3D.new()
		fm.albedo_color = Color(0.3, 0.6, 1.0)
		fm.emission = Color(0.2, 0.7, 1.0)
		fm.emission_energy = 4.0
		fb.material = fm
		flame.mesh = fb
		flame.position = Vector3(x * 0.6, -0.12, 2.35)
		flame.material_override = fm
		flame.visible = false
		add_child(flame)
		flame_lights.append(flame)


func apply_rims(color: Color, style: int) -> void:
	rim_color = color
	rim_style = clampi(style, 0, 3)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = 0.92
	mat.roughness = 0.18
	for spoke in spoke_nodes:
		if is_instance_valid(spoke):
			spoke.queue_free()
	spoke_nodes.clear()
	var spoke_counts: Array[int] = [5, 7, 10, 6]
	var spoke_widths: Array[float] = [0.025, 0.022, 0.018, 0.042]
	for rim in rim_meshes:
		rim.material_override = mat
		rim.scale = Vector3.ONE * (0.92 + float(rim_style) * 0.07)
		var parent := rim.get_parent()
		if parent == null:
			continue
		var count: int = spoke_counts[rim_style]
		for i in count:
			var a := TAU * float(i) / float(count)
			var spoke := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(0.035, spoke_widths[rim_style], 0.23)
			box.material = mat
			spoke.mesh = box
			spoke.material_override = mat
			var side_sign := 1.0 if (parent as Node3D).position.x > 0.0 else -1.0
			spoke.position = Vector3(0.17 * side_sign, cos(a) * 0.10, sin(a) * 0.10)
			spoke.rotation.x = a
			parent.add_child(spoke)
			spoke_nodes.append(spoke)


func apply_suspension(index: int) -> void:
	suspension_index = clampi(index, 0, REST_LENGTHS.size() - 1)
	for w in wheels:
		w.wheel_rest_length = REST_LENGTHS[suspension_index]
	var delta: float = float(RIDE_OFFSETS[suspension_index]) - suspension_offset
	if model_root != null and is_instance_valid(model_root):
		model_root.position.y += delta
	suspension_offset = float(RIDE_OFFSETS[suspension_index])


func set_tire(index: int) -> void:
	tire_index = clampi(index, 0, TIRE_GRIPS.size() - 1)
	tire_grip = TIRE_GRIPS[tire_index]
	for w in wheels:
		w.wheel_friction_slip = tire_grip


func set_final_drive(index: int) -> void:
	final_drive_index = clampi(index, 0, FINAL_DRIVES.size() - 1)
	final_drive = FINAL_DRIVES[final_drive_index]


func apply_spoiler(enabled: bool) -> void:
	spoiler_enabled = enabled
	rebuild_cosmetics()


func apply_decal(style: int) -> void:
	decal_style = clampi(style, 0, 3)
	rebuild_cosmetics()


func rebuild_cosmetics() -> void:
	if cosmetic_root == null:
		return
	for child in cosmetic_root.get_children():
		child.queue_free()
	var accent := StandardMaterial3D.new()
	accent.albedo_color = Color(0.92, 0.95, 1.0)
	accent.emission = Color(0.15, 0.55, 0.9)
	accent.emission_energy = 0.5
	accent.roughness = 0.35
	var half_width := clampf((body_top - body_bottom) * 1.6 + 0.3, 0.8, 1.2)
	var body_len := body_rear - body_front
	if spoiler_enabled:
		var wing := MeshInstance3D.new()
		var wing_mesh := BoxMesh.new()
		wing_mesh.size = Vector3(half_width * 2.0, 0.08, 0.42)
		wing_mesh.material = accent
		wing.mesh = wing_mesh
		wing.position = Vector3(0, body_top + 0.10, body_rear - 0.16)
		wing.rotation.x = -0.10
		wing.material_override = accent
		cosmetic_root.add_child(wing)
		for x in [-half_width * 0.7, half_width * 0.7]:
			var strut := MeshInstance3D.new()
			var strut_mesh := BoxMesh.new()
			strut_mesh.size = Vector3(0.07, 0.38, 0.12)
			strut_mesh.material = accent
			strut.mesh = strut_mesh
			strut.position = Vector3(x, body_top - 0.08, body_rear - 0.16)
			strut.material_override = accent
			cosmetic_root.add_child(strut)
	if decal_style > 0:
		var colours := [Color(1, 1, 1), Color(1, 0.22, 0.30), Color(1, 0.78, 0.12), Color(0.35, 0.95, 0.55)]
		var decal_mat := StandardMaterial3D.new()
		decal_mat.albedo_color = colours[decal_style - 1]
		decal_mat.emission = colours[decal_style - 1]
		decal_mat.emission_energy = 0.35
		var offsets := [0.0, -0.24, 0.24]
		for x in offsets:
			var stripe := MeshInstance3D.new()
			var stripe_mesh := BoxMesh.new()
			stripe_mesh.size = Vector3(0.12 if absf(x) > 0.01 else 0.22, 0.012, body_len * 0.82)
			stripe_mesh.material = decal_mat
			stripe.mesh = stripe_mesh
			stripe.position = Vector3(x, body_top + 0.012, (body_front + body_rear) * 0.5)
			stripe.material_override = decal_mat
			cosmetic_root.add_child(stripe)


func configure(engine_index: int) -> void:
	var multipliers := [0.82, 1.0, 1.24, 1.52]
	var names := ["STREET", "SPORT", "RACE", "NOS READY"]
	var i := clampi(engine_index, 0, 3)
	engine_name = names[i]
	engine_force_max = 5200.0 * multipliers[i]
	mass_kg = 1250.0 - i * 55.0
	mass = mass_kg
	boosting = i == 3
	for f in flame_lights:
		f.visible = boosting


func reset_at(pos: Vector3, forward: Vector3) -> void:
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	global_position = pos + Vector3.UP * 0.75
	look_at(global_position + forward, Vector3.UP)
	gear = 1
	reverse = false
	rpm = 900.0
	shift_timer = 0.0
	nitro = 100.0
	damage = 0.0


func drive(throttle: float, brake_input: float, steer_input: float, dt: float) -> void:
	speed_kmh = linear_velocity.length() * 3.6
	shift_timer = maxf(shift_timer - dt, 0.0)
	# The reverse -> drive transition must be atomic. Leaving gear at -1 made
	# the ratio lookup negative and produced NaN RPM/force in the old game.
	if !reverse and speed_kmh < 4.0 and brake_input > 0.5 and throttle < 0.1:
		reverse = true
		gear = -1
		rpm = 1000.0
		shift_timer = 0.22
	elif reverse and throttle > 0.5 and speed_kmh < 7.0:
		reverse = false
		gear = 1
		rpm = 1100.0
		shift_timer = 0.24
	if shift_timer <= 0.0 and !reverse:
		var up := [38, 72, 108, 148, 190]
		var down := [30, 62, 96, 134, 174]
		if gear < RATIOS.size() and speed_kmh > up[gear - 1]:
			gear += 1
			rpm = 3200.0
			shift_timer = 0.18
		elif gear > 1 and speed_kmh < down[gear - 2]:
			gear -= 1
			rpm = 4800.0
			shift_timer = 0.14
	var ratio: float
	if reverse:
		ratio = 3.4
	else:
		var gi := clampi(gear - 1, 0, RATIOS.size() - 1)
		ratio = RATIOS[gi] * final_drive
	var target_rpm := 900.0 + absf(speed_kmh) * ratio * 7.4
	rpm = lerpf(rpm, clampf(target_rpm, 850.0, 8200.0), 0.18)
	var torque_curve := 1.0 - clampf((rpm - 6500.0) / 2200.0, 0.0, 0.45)
	# Wheel force scales WITH the gear ratio, not against it. Dividing by the
	# ratio made a 1250 kg car accelerate at 0.1 m/s² and never reach speed.
	var gear_mult := clampf(ratio * 0.10, 0.35, 1.35)
	var force := engine_force_max * throttle * torque_curve * gear_mult
	if reverse:
		force = -absf(engine_force_max) * throttle * 0.30
	if damage > 0.0:
		force *= 1.0 - damage * 0.35
	# Godot's VehicleBody3D applies positive engine_force along local +Z, while
	# every direction in this game (camera, AI, spawn) treats -Z as forward.
	engine_force = -force
	brake = brake_input * brake_force_max
	# Speed-sensitive steering: enough angle to recover at walking pace, calm
	# enough at 180 km/h that a tap does not spin the car.
	var max_angle := lerpf(0.58, 0.22, clampf(speed_kmh / 180.0, 0.0, 1.0))
	steering = lerpf(steering, clampf(steer_input, -1.0, 1.0) * max_angle, clampf(dt * 14.0, 0.0, 1.0))
	for light in brake_lights:
		var m := light.material_override as StandardMaterial3D
		if m != null:
			m.emission_energy = 3.0 if brake_input > 0.2 else 0.4
	if boosting and throttle > 0.6 and nitro > 0.0:
		nitro = maxf(nitro - dt * 12.0, 0.0)
		engine_force *= 1.35
		for f in flame_lights:
			f.visible = true
			f.scale.z = 1.0 + sin(Time.get_ticks_msec() * 0.04) * 0.25
	else:
		for f in flame_lights:
			f.visible = boosting
		nitro = minf(nitro + dt * 2.2, 100.0)


func _on_collision(amount: float) -> void:
	last_collision_speed = amount
	damage = clampf(damage + amount * 0.0015, 0.0, 1.0)
