extends RigidBody3D
class_name RaceCar

## Physics-driven car. The suspension is a hand-written raycast spring/damper
## system rather than VehicleBody3D: raycasts explicitly exclude this body, so
## a wheel can never collide with its own chassis and silently lose contact.

class WheelState:
	var name := ""
	var mount := Vector3.ZERO
	var front := false
	var radius := 0.36
	var rest_length := 0.38
	var stiffness := 26000.0
	var compression := 0.0
	var damping := 3200.0
	var grounded := false
	var contact_point := Vector3.ZERO
	var normal := Vector3.UP
	var spring_force := 0.0
	var drive_force := 0.0
	var lateral_force := 0.0
	var spin := 0.0
	var visual: Node3D = null

	func is_in_contact() -> bool:
		return grounded


@export var model_path: String = ""
@export var display_name: String = "Car"
@export var author: String = ""
@export var license_name: String = ""
@export var engine_force_max: float = 7200.0
@export var brake_force_max: float = 11000.0
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

# Drive state consumed by the suspension integrator.
var engine_force: float = 0.0
var brake: float = 0.0
var steering: float = 0.0

var wheels: Array[WheelState] = []
var rim_meshes: Array[MeshInstance3D] = []
var spoke_nodes: Array[Node3D] = []
var model_root: Node3D = null
var cosmetic_root: Node3D = null
var brake_lights: Array[MeshInstance3D] = []
var flame_lights: Array[MeshInstance3D] = []
var last_collision_speed := 0.0
var suspension_offset := 0.0
var body_top := 1.0
var body_bottom := -0.30
var body_front := -2.175
var body_rear := 2.175

var last_safe_pos := Vector3.ZERO
var last_safe_forward := Vector3.FORWARD

const RATIOS := [3.42, 2.15, 1.52, 1.16, 0.92, 0.74]
const FINAL_DRIVES := [3.20, 3.70, 4.15]
# Friction coefficients for STREET / SPORT / SLICK compounds.
const TIRE_GRIPS := [1.05, 1.35, 1.75]
const REST_LENGTHS := [0.32, 0.40, 0.50]
const SPRING_RATES := [34000.0, 27000.0, 21000.0]
const RIDE_OFFSETS := [-0.05, 0.0, 0.06]
const WHEEL_MOUNTS := [
	Vector3(-0.82, 0.10, -1.35),
	Vector3(0.82, 0.10, -1.35),
	Vector3(-0.82, 0.10, 1.35),
	Vector3(0.82, 0.10, 1.35),
]


func _apply_mass_properties() -> void:
	mass = mass_kg
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, -0.22, 0)
	# Low pitch inertia makes turn-in responsive; high yaw inertia stops the
	# car spinning like a top after a kerb strike.
	inertia = Vector3(mass_kg * 1.76, mass_kg * 1.92, mass_kg * 0.50)


func _ready() -> void:
	_apply_mass_properties()
	# A real chassis shape is safe now because suspension rays exclude self.
	var hull := CollisionShape3D.new()
	hull.name = "Hull"
	var hull_box := BoxShape3D.new()
	hull_box.size = Vector3(1.55, 0.62, 3.9)
	hull.shape = hull_box
	hull.position = Vector3(0, 0.20, 0)
	add_child(hull)
	linear_damp = 0.015
	angular_damp = 0.30
	contact_monitor = true
	max_contacts_reported = 6
	body_entered.connect(_on_body_entered)

	cosmetic_root = Node3D.new()
	cosmetic_root.name = "Cosmetics"
	add_child(cosmetic_root)
	load_model()
	build_wheels()
	build_lights()
	apply_paint(paint_color)
	apply_rims(rim_color, rim_style)
	apply_suspension(suspension_index)
	set_tire(tire_index)
	set_final_drive(final_drive_index)
	rebuild_cosmetics()
	last_safe_pos = global_position
	last_safe_forward = -global_transform.basis.z


func _physics_process(delta: float) -> void:
	speed_kmh = linear_velocity.length() * 3.6
	update_wheel_visuals()
	_update_safety()
	if absf(linear_velocity.length()) > 140.0:
		linear_velocity = linear_velocity.normalized() * 140.0


func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	# Applying suspension, tyre and engine forces inside the physics integrator
	# guarantees they are consumed in the same step they are calculated.
	_integrate_suspension(state.get_step())


func _on_body_entered(_body: Node) -> void:
	var impact := linear_velocity.length()
	if impact > 6.0:
		last_collision_speed = impact
		damage = clampf(damage + impact * 0.0012, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Suspension and tyre model
# ---------------------------------------------------------------------------

func _integrate_suspension(delta: float) -> void:
	var world := get_world_3d()
	if world == null:
		return
	var space := world.direct_space_state
	var up_axis := global_transform.basis.y.normalized()
	var forward_axis := -global_transform.basis.z.normalized()
	var grounded_count := 0
	var total_spring := 0.0
	for w in wheels:
		w.grounded = false
		w.compression = 0.0
		w.spring_force = 0.0
		var from := to_global(w.mount)
		var down := -up_axis
		var reach := w.rest_length + w.radius + 0.30
		var query := PhysicsRayQueryParameters3D.create(from, from + down * reach, 0xFFFFFFFF, [get_rid()])
		var hit := space.intersect_ray(query)
		if hit.is_empty():
			continue
		var point: Vector3 = hit.position
		var normal: Vector3 = hit.normal
		if normal.dot(up_axis) < 0.25:
			continue
		var dist := (point - from).dot(down)
		var suspension_len := dist - w.radius
		var compression := w.rest_length - suspension_len
		if compression < 0.0 or compression > w.rest_length + w.radius:
			continue
		w.grounded = true
		w.compression = compression
		w.contact_point = point
		w.normal = normal.normalized()
		grounded_count += 1

		var offset := from - global_position
		var point_velocity := linear_velocity + angular_velocity.cross(offset)
		var susp_velocity := point_velocity.dot(up_axis)
		var spring := w.stiffness * compression - w.damping * susp_velocity
		spring = clampf(spring, 0.0, 90000.0)
		w.spring_force = spring
		total_spring += spring
		_apply_wheel_force(up_axis * spring, point)

	# Anti-roll bars keep body roll from building up in fast corners.
	var anti_roll := 5200.0
	for pair in [[0, 1], [2, 3]]:
		var a: WheelState = wheels[int(pair[0])]
		var b: WheelState = wheels[int(pair[1])]
		if !a.grounded or !b.grounded:
			continue
		var delta_force := clampf((a.compression - b.compression) * anti_roll, -9000.0, 9000.0)
		_apply_wheel_force(up_axis * delta_force, a.contact_point)
		_apply_wheel_force(up_axis * -delta_force, b.contact_point)

	if grounded_count == 0:
		return

	var mu := tire_grip * (1.0 - damage * 0.28)
	var steer_angle := steering
	for i in wheels.size():
		var w: WheelState = wheels[i]
		if !w.grounded:
			continue
		var normal_axis := w.normal
		var tyre_forward := forward_axis
		if w.front:
			tyre_forward = tyre_forward.rotated(global_transform.basis.y, steer_angle)
		tyre_forward = (tyre_forward - normal_axis * tyre_forward.dot(normal_axis)).normalized()
		var tyre_right := tyre_forward.cross(normal_axis).normalized()

		var offset := w.contact_point - global_position
		var contact_velocity := linear_velocity + angular_velocity.cross(offset)
		var v_long := contact_velocity.dot(tyre_forward)
		var v_lat := contact_velocity.dot(tyre_right)
		var load := maxf(w.spring_force, 1500.0)
		var limit := load * mu

		# Tyre cornering stiffness. The old 9.0 gain saturated the friction
		# circle on steering input alone and starved the engine of grip.
		var lateral := -v_lat * load * 0.18
		var longitudinal := engine_force / float(grounded_count)
		if brake > 0.0 and absf(v_long) > 0.2:
			longitudinal += -signf(v_long) * brake_force_max / float(grounded_count)
		longitudinal += -v_long * 8.0

		var tyre_force := Vector2(longitudinal, lateral)
		if tyre_force.length() > limit:
			tyre_force = tyre_force.normalized() * limit
		w.drive_force = tyre_force.x
		w.lateral_force = tyre_force.y
		# Longitudinal force is applied at the centre to avoid the engine
		# endlessly trying to wheelie into the angular damper; lateral force
		# stays at the contact patch so steering still creates yaw.
		_apply_wheel_force(tyre_forward * tyre_force.x, global_position)
		_apply_wheel_force(tyre_right * tyre_force.y, w.contact_point)
		w.spin += v_long * delta / w.radius

	# Aerodynamic drag and downforce. Downforce only while planted keeps jumps
	# from slamming the car into the asphalt mid-air.
	var speed := linear_velocity.length()
	apply_central_force(-linear_velocity * speed * 0.32)
	if grounded_count >= 2:
		_apply_wheel_force(-up_axis * speed * speed * 1.8, global_position)

	if grounded_count >= 2 and global_position.y > -4.0:
		last_safe_pos = global_position
		last_safe_forward = forward_axis


func _apply_wheel_force(force: Vector3, point: Vector3) -> void:
	apply_central_force(force)
	apply_torque((point - global_position).cross(force))


func update_wheel_visuals() -> void:
	for w in wheels:
		if w.visual == null:
			continue
		var travel := clampf(w.rest_length - w.compression, -0.05, w.rest_length + 0.20)
		w.visual.position = Vector3(w.mount.x, w.mount.y - travel, w.mount.z)
		w.visual.rotation.y = steering if w.front else 0.0
		var spinner := w.visual.get_node_or_null("Spinner")
		if spinner != null:
			spinner.rotation.x = w.spin


func _update_safety() -> void:
	if global_position.y > -7.0 and linear_velocity.length() < 140.0:
		return
	reset_at(last_safe_pos, last_safe_forward)


# ---------------------------------------------------------------------------
# Model loading and presentation
# ---------------------------------------------------------------------------

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
	_strip_non_body_nodes(instance)
	model_root.add_child(instance)
	normalize_model(model_root)


func _mesh_aabb(mi: MeshInstance3D) -> AABB:
	if mi.mesh == null:
		return AABB()
	return mi.global_transform * mi.mesh.get_aabb()


func _body_aabb(root: Node3D) -> AABB:
	var box := AABB(root.global_transform.origin, Vector3.ZERO)
	var first := true
	var stack: Array[Node] = [root]
	while stack.size() > 0:
		var n: Node = stack.pop_back()
		if n is MeshInstance3D and !_is_decorative(n):
			var b := _mesh_aabb(n as MeshInstance3D)
			if b.size.x <= 0.0 or b.size.y <= 0.0 or b.size.z <= 0.0:
				pass
			elif first:
				box = b
				first = false
			else:
				box = box.merge(b)
		for c in n.get_children():
			stack.append(c)
	return box


func _is_decorative(node: Node) -> bool:
	var n: Node = node
	while n != null:
		var lower := n.name.to_lower()
		for token in ["shadow", "text", "logo", "license", "plate"]:
			if lower.contains(token):
				return true
		n = n.get_parent()
	return false


func _strip_non_body_nodes(node: Node) -> void:
	# Source GLBs bake wheels, brakes and oversized ground-shadow planes into the
	# hierarchy. Those inflate the bounds and double up with our own wheels.
	var doomed: Array[Node] = []
	var stack: Array[Node] = [node]
	while stack.size() > 0:
		var n: Node = stack.pop_back()
		var lower := n.name.to_lower()
		if lower.contains("wheel") or lower.contains("tire") or lower.contains("tyre") \
			or lower.contains("rim") or lower.contains("brake") or lower.contains("shadow") \
			or lower.contains("text") or lower.contains("logo"):
			doomed.append(n)
			continue
		for c in n.get_children():
			stack.append(c)
	for n in doomed:
		var parent := n.get_parent()
		if parent != null:
			parent.remove_child(n)
		n.queue_free()


func _orient_model(root: Node3D) -> AABB:
	var axes := [Vector3.RIGHT, Vector3.UP, Vector3.BACK]
	var perms := [
		[0, 1, 2], [0, 2, 1], [1, 0, 2],
		[1, 2, 0], [2, 0, 1], [2, 1, 0],
	]
	var best_basis := Basis()
	var best_box := AABB()
	var best_score := INF
	for perm in perms:
		for sx in [-1, 1]:
			for sy in [-1, 1]:
				for sz in [-1, 1]:
					var bx: Vector3 = axes[int(perm[0])] * float(sx)
					var by: Vector3 = axes[int(perm[1])] * float(sy)
					var bz: Vector3 = axes[int(perm[2])] * float(sz)
					var basis := Basis(bx, by, bz)
					if bx.cross(by).dot(bz) < 0.0:
						continue
					root.transform = Transform3D(basis, Vector3.ZERO)
					var box := _body_aabb(root)
					var dims := [box.size.x, box.size.y, box.size.z]
					dims.sort()
					var score := absf(box.size.x - float(dims[1])) \
						+ absf(box.size.y - float(dims[0])) \
						+ absf(box.size.z - float(dims[2]))
					if score < best_score:
						best_score = score
						best_basis = basis
						best_box = box
	root.transform = Transform3D(best_basis, Vector3.ZERO)
	return best_box


func normalize_model(root: Node3D) -> void:
	root.transform = Transform3D.IDENTITY
	var box := _body_aabb(root)
	if box.size.x <= 1e-5 or box.size.z <= 1e-5 or box.size.y <= 1e-5:
		push_warning("Degenerate car model: " + model_path)
		return
	# Sketchfab exports arrive in every imaginable axis convention. Pick the
	# axis-aligned rotation that makes the longest dimension the length (Z),
	# the shortest the height (Y) and the remaining one the width (X).
	box = _orient_model(root)
	# A few models face +Z. Front lamps are a reliable clue.
	var front_marker := 0.0
	var marker_count := 0
	var stack: Array[Node] = [root]
	while stack.size() > 0:
		var n: Node = stack.pop_back()
		if n is MeshInstance3D:
			var mi := n as MeshInstance3D
			var marker := false
			var lower := n.name.to_lower()
			if lower.contains("front") or lower.contains("headlight"):
				marker = true
			for s in mi.mesh.get_surface_count() if mi.mesh != null else 0:
				var mat := mi.mesh.surface_get_material(s)
				if mat != null:
					var mn := mat.resource_name.to_lower()
					if mn.contains("front") or mn.contains("headlight"):
						marker = true
			if marker:
				front_marker += _mesh_aabb(mi).get_center().z
				marker_count += 1
		for c in n.get_children():
			stack.append(c)
	if marker_count > 0 and front_marker / float(marker_count) > box.get_center().z:
		var flip := Transform3D(Basis(Vector3.UP, PI), Vector3.ZERO)
		root.transform = flip * root.transform
		box = _body_aabb(root)

	# Bake the orientation into the child so later scaling happens in the car's
	# world-aligned axes (length Z, width X, height Y).
	var fitted_transform := root.transform
	for child in root.get_children():
		if child is Node3D:
			(child as Node3D).transform = fitted_transform * (child as Node3D).transform
	root.transform = Transform3D.IDENTITY
	box = _body_aabb(root)

	# Uniform scale preserves the shape of every model. The tightest dimension
	# limit wins so no car becomes a stretched box.
	var scale := minf(
		4.35 / maxf(box.size.z, 1e-5),
		minf(2.05 / maxf(box.size.x, 1e-5), 1.55 / maxf(box.size.y, 1e-5))
	)
	root.scale = Vector3.ONE * scale
	var fitted := _body_aabb(root)
	# A couple of exports are unusually stubby after a safe uniform fit. A
	# bounded length-only correction keeps them racing-scale without visibly
	# distorting the silhouette.
	if fitted.size.z < 3.2:
		var stretch := clampf(3.2 / maxf(fitted.size.z, 0.01), 1.0, 1.55)
		root.scale.z *= stretch
		fitted = _body_aabb(root)
	root.position = Vector3(
		-fitted.get_center().x,
		-0.30 - fitted.position.y,
		-fitted.get_center().z
	)
	fitted = _body_aabb(root)
	body_bottom = fitted.position.y
	body_top = fitted.end.y
	body_front = fitted.position.z
	body_rear = fitted.end.z
	suspension_offset = 0.0


func _paintable(mat: Material) -> bool:
	if mat == null:
		return true
	var n: String = mat.resource_name.to_lower()
	for skip in ["glass", "window", "windshield", "light", "lamp", "tyre", "tire", "rim", "wheel", "mirror", "plate", "interior", "seat", "chrome", "shadow"]:
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
		if n is MeshInstance3D and !_is_decorative(n):
			var mi := n as MeshInstance3D
			var count := mi.mesh.get_surface_count() if mi.mesh != null else 0
			for s in count:
				var mat: Material = mi.get_surface_override_material(s)
				if mat == null and mi.mesh != null:
					mat = mi.mesh.surface_get_material(s)
				if mat is StandardMaterial3D and _paintable(mat):
					var m := (mat as StandardMaterial3D).duplicate()
					m.albedo_color = color
					m.metallic = 0.38
					m.roughness = 0.30
					mi.set_surface_override_material(s, m)
				elif mat == null:
					var m2 := StandardMaterial3D.new()
					m2.albedo_color = color
					m2.metallic = 0.38
					m2.roughness = 0.30
					mi.set_surface_override_material(s, m2)
		for c in n.get_children():
			stack.append(c)


func build_wheels() -> void:
	var wheel_mat := StandardMaterial3D.new()
	wheel_mat.albedo_color = Color(0.035, 0.038, 0.045)
	wheel_mat.roughness = 0.82
	var rim_mat := StandardMaterial3D.new()
	rim_mat.albedo_color = rim_color
	rim_mat.metallic = 0.90
	rim_mat.roughness = 0.20
	for i in WHEEL_MOUNTS.size():
		var local: Vector3 = WHEEL_MOUNTS[i]
		var is_front := local.z < 0.0
		var w := WheelState.new()
		w.name = "Wheel_%s_%s" % [("L" if local.x < 0.0 else "R"), ("F" if is_front else "R")]
		w.mount = local
		w.front = is_front
		w.rest_length = REST_LENGTHS[suspension_index]
		w.stiffness = SPRING_RATES[suspension_index]
		w.damping = 4800.0 if is_front else 4400.0
		wheels.append(w)

		var visual := Node3D.new()
		visual.name = w.name
		visual.position = local
		add_child(visual)
		w.visual = visual
		var spinner := Node3D.new()
		spinner.name = "Spinner"
		visual.add_child(spinner)

		var tyre := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = w.radius
		cyl.bottom_radius = w.radius
		cyl.height = 0.26
		cyl.radial_segments = 20
		tyre.mesh = cyl
		tyre.rotation.z = PI * 0.5
		tyre.material_override = wheel_mat
		spinner.add_child(tyre)

		var rim := MeshInstance3D.new()
		rim.name = "Rim"
		rim.set_meta("side", signf(local.x))
		var rc := CylinderMesh.new()
		rc.top_radius = 0.21
		rc.bottom_radius = 0.21
		rc.height = 0.28
		rc.radial_segments = 20
		rim.mesh = rc
		rim.rotation.z = PI * 0.5
		rim.material_override = rim_mat
		spinner.add_child(rim)
		rim_meshes.append(rim)


func build_lights() -> void:
	var nose := body_front + 0.10
	var tail := body_rear - 0.10
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
		head.position = Vector3(x, 0.22, nose)
		head.material_override = hm
		add_child(head)
		var light := MeshInstance3D.new()
		var tb := BoxMesh.new()
		tb.size = Vector3(0.34, 0.10, 0.06)
		var tail_mat := StandardMaterial3D.new()
		tail_mat.albedo_color = Color(0.25, 0.01, 0.01)
		tail_mat.emission = Color(1.0, 0.05, 0.02)
		tail_mat.emission_energy = 1.2
		tb.material = tail_mat
		light.mesh = tb
		light.position = Vector3(x, 0.20, tail)
		light.material_override = tail_mat
		add_child(light)
		brake_lights.append(light)


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
		var side: float = float(rim.get_meta("side", 1.0))
		var count: int = spoke_counts[rim_style]
		for i in count:
			var a := TAU * float(i) / float(count)
			var spoke := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(0.035, spoke_widths[rim_style], 0.23)
			box.material = mat
			spoke.mesh = box
			spoke.material_override = mat
			spoke.position = Vector3(0.17 * side, cos(a) * 0.10, sin(a) * 0.10)
			spoke.rotation.x = a
			parent.add_child(spoke)
			spoke_nodes.append(spoke)


func apply_suspension(index: int) -> void:
	suspension_index = clampi(index, 0, REST_LENGTHS.size() - 1)
	for w in wheels:
		w.rest_length = REST_LENGTHS[suspension_index]
		w.stiffness = SPRING_RATES[suspension_index]
	var delta := float(RIDE_OFFSETS[suspension_index]) - suspension_offset
	if model_root != null and is_instance_valid(model_root):
		model_root.position.y += delta
	suspension_offset = float(RIDE_OFFSETS[suspension_index])


func set_tire(index: int) -> void:
	tire_index = clampi(index, 0, TIRE_GRIPS.size() - 1)
	tire_grip = TIRE_GRIPS[tire_index]


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
	var half_width := clampf((body_top - body_bottom) * 1.4 + 0.3, 0.75, 1.05)
	var body_len := maxf(body_rear - body_front, 3.0)
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
		for x in [0.0, -0.24, 0.24]:
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
	engine_force_max = 7200.0 * multipliers[i]
	mass_kg = 1250.0 - i * 55.0
	_apply_mass_properties()
	boosting = i == 3
	for f in flame_lights:
		f.visible = boosting


func reset_at(pos: Vector3, forward: Vector3) -> void:
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	global_position = pos + Vector3.UP * 0.85
	look_at(global_position + forward, Vector3.UP)
	gear = 1
	reverse = false
	rpm = 900.0
	shift_timer = 0.0
	nitro = 100.0
	damage = 0.0
	engine_force = 0.0
	brake = brake_force_max
	steering = 0.0
	last_safe_pos = global_position
	last_safe_forward = forward.normalized()
	for w in wheels:
		w.compression = 0.0
		w.spin = 0.0


func drive(throttle: float, brake_input: float, steer_input: float, dt: float) -> void:
	speed_kmh = linear_velocity.length() * 3.6
	shift_timer = maxf(shift_timer - dt, 0.0)
	# Reverse -> drive is atomic. Never let gear -1 reach the ratio lookup.
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
		ratio = RATIOS[clampi(gear - 1, 0, RATIOS.size() - 1)] * final_drive
	var target_rpm := 900.0 + absf(speed_kmh) * ratio * 7.4
	rpm = lerpf(rpm, clampf(target_rpm, 850.0, 8200.0), 0.18)
	var torque_curve := 1.0 - clampf((rpm - 6500.0) / 2200.0, 0.0, 0.45)
	var gear_mult := clampf(ratio * 0.10, 0.35, 1.35)
	engine_force = engine_force_max * throttle * torque_curve * gear_mult
	if reverse:
		engine_force = -absf(engine_force_max) * throttle * 0.30
	if damage > 0.0:
		engine_force *= 1.0 - damage * 0.35
	# While in reverse the brake pedal is the reverse throttle, so applying the
	# service brake here would fight the engine and stall the car.
	brake = 0.0 if reverse else clampf(brake_input, 0.0, 1.0) * brake_force_max
	# A small low-speed holding force stops the car creeping down the banked
	# grid before the lights go out, without making the pedals feel sticky.
	if speed_kmh < 2.0 and throttle < 0.1 and brake_input < 0.1:
		linear_velocity *= 0.84
		angular_velocity *= 0.84
	var max_angle := lerpf(0.55, 0.24, clampf(speed_kmh / 190.0, 0.0, 1.0))
	steering = lerpf(steering, clampf(steer_input, -1.0, 1.0) * max_angle, clampf(dt * 13.0, 0.0, 1.0))
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
