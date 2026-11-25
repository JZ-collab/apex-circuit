extends Node3D
class_name RaceTrack

## Procedural circuit: Catmull-Rom centreline, banked asphalt, curbs,
## guardrails, embankments, terrain, trees and rocks. Everything is generated
## in Godot at runtime - no HTML, no JavaScript, no external track assets.

const SAMPLES := 720
const ROAD_WIDTH := 13.0
const HALF_ROAD := ROAD_WIDTH * 0.5
const ROAD_LIFT := 0.03

var points: Array[Vector3] = []
var tangents: Array[Vector3] = []
var rights: Array[Vector3] = []
var banks: Array[float] = []
var length := 0.0

var road_mesh: ArrayMesh
var collision_body: StaticBody3D


func _ready() -> void:
	build_spline()
	build_road()
	build_curbs_and_lines()
	build_start_line()
	build_embankments()
	build_terrain()
	build_guardrails()
	build_guardrail_collision()
	build_scenery()
	build_environment()


func build_spline() -> void:
	# Smooth closed mountain-coast circuit. Control points are spaced evenly
	# around an oval and Catmull-Rom interpolation produces fast sweeps and a
	# tightening final corner without the self-crossing of the old layout.
	var control := [
		Vector3(0, 1, 0),
		Vector3(70, 3, -8),
		Vector3(128, 9, -58),
		Vector3(150, 14, -128),
		Vector3(112, 11, -186),
		Vector3(42, 5, -214),
		Vector3(-32, 2, -202),
		Vector3(-88, 6, -162),
		Vector3(-116, 12, -104),
		Vector3(-102, 9, -38),
		Vector3(-54, 3, -2),
	]
	var n := control.size()
	for i in SAMPLES:
		var u := float(i) / float(SAMPLES) * float(n)
		var idx := int(floor(u)) % n
		var t: float = u - floorf(u)
		var p0: Vector3 = control[(idx - 1 + n) % n]
		var p1: Vector3 = control[idx]
		var p2: Vector3 = control[(idx + 1) % n]
		var p3: Vector3 = control[(idx + 2) % n]
		points.append(catmull(p0, p1, p2, p3, t))
	for i in SAMPLES:
		var prev: Vector3 = points[(i - 1 + SAMPLES) % SAMPLES]
		var next: Vector3 = points[(i + 1) % SAMPLES]
		var tan := (next - prev).normalized()
		tangents.append(tan)
		var right := tan.cross(Vector3.UP).normalized()
		rights.append(right)
	for i in SAMPLES:
		var prev_tan: Vector3 = tangents[(i - 1 + SAMPLES) % SAMPLES]
		var tan: Vector3 = tangents[i]
		var cross_y := prev_tan.x * tan.z - prev_tan.z * tan.x
		banks.append(clampf(cross_y * 22.0, -0.10, 0.10))
	length = 0.0
	for i in SAMPLES:
		length += points[i].distance_to(points[(i + 1) % SAMPLES])


func catmull(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: float) -> Vector3:
	var t2 := t * t
	var t3 := t2 * t
	return 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)


func edge(i: int, side: int, extra := 0.0) -> Vector3:
	var p: Vector3 = points[i]
	var r: Vector3 = rights[i]
	var b: float = banks[i]
	var off := HALF_ROAD + extra
	return p + r * (off * float(side)) + Vector3.UP * (-b * off * float(side) + ROAD_LIFT)


func build_road() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in SAMPLES:
		var j := (i + 1) % SAMPLES
		var l0 := edge(i, -1)
		var r0 := edge(i, 1)
		var l1 := edge(j, -1)
		var r1 := edge(j, 1)
		var u0 := float(i) / float(SAMPLES) * 40.0
		var u1 := float(i + 1) / float(SAMPLES) * 40.0
		st.set_uv(Vector2(0, u0)); st.add_vertex(l0)
		st.set_uv(Vector2(1, u0)); st.add_vertex(r0)
		st.set_uv(Vector2(1, u1)); st.add_vertex(r1)
		st.set_uv(Vector2(0, u1)); st.add_vertex(l1)
		st.add_index(i * 4 + 0); st.add_index(i * 4 + 1); st.add_index(i * 4 + 2)
		st.add_index(i * 4 + 0); st.add_index(i * 4 + 2); st.add_index(i * 4 + 3)
	st.generate_normals()
	road_mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.18, 0.20, 0.23)
	mat.roughness = 0.92
	mat.metallic = 0.02
	var grain := FastNoiseLite.new()
	grain.noise_type = FastNoiseLite.TYPE_PERLIN
	grain.frequency = 0.42
	var grain_tex := NoiseTexture2D.new()
	grain_tex.noise = grain
	grain_tex.width = 256
	grain_tex.height = 256
	grain_tex.seamless = true
	mat.albedo_texture = grain_tex
	road_mesh.surface_set_material(0, mat)
	var mi := MeshInstance3D.new()
	mi.name = "Asphalt"
	mi.mesh = road_mesh
	add_child(mi)
	collision_body = StaticBody3D.new()
	collision_body.name = "CircuitCollision"
	add_child(collision_body)
	build_road_collision()


func build_road_collision() -> void:
	# A chain of overlapping boxes is far more stable than one giant trimesh.
	var step := 4
	for i in range(0, SAMPLES, step):
		var j := (i + step) % SAMPLES
		var mid := (points[i] + points[j]) * 0.5
		var seg_len := points[i].distance_to(points[j])
		var basis := Basis(rights[i], Vector3.UP, -tangents[i]).orthonormalized()
		var box := BoxShape3D.new()
		box.size = Vector3(ROAD_WIDTH, 0.5, seg_len + 0.8)
		var cs := CollisionShape3D.new()
		cs.shape = box
		cs.transform = Transform3D(basis, mid + Vector3.UP * -0.24)
		collision_body.add_child(cs)


func strip_mesh(width: float, side: int, extra: float, color_a: Color, color_b: Color, dash := false) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var vi := 0
	for i in SAMPLES:
		var j := (i + 1) % SAMPLES
		if dash and (int(i / 12) % 2) == 1:
			continue
		var a := edge(i, side, extra)
		var b := edge(i, side, extra + width)
		var c := edge(j, side, extra + width)
		var d := edge(j, side, extra)
		var col := color_a if (int(i / 8) % 2) == 0 else color_b
		for v in [a, b, c, d]:
			st.set_color(col)
			st.add_vertex(v)
		st.add_index(vi); st.add_index(vi + 1); st.add_index(vi + 2)
		st.add_index(vi); st.add_index(vi + 2); st.add_index(vi + 3)
		vi += 4
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.7
	mesh.surface_set_material(0, mat)
	return mesh


func add_mesh(mesh: ArrayMesh, name: String) -> void:
	var mi := MeshInstance3D.new()
	mi.name = name
	mi.mesh = mesh
	add_child(mi)


func add_collision(mesh: ArrayMesh) -> void:
	if collision_body == null:
		collision_body = StaticBody3D.new()
		collision_body.name = "CircuitCollision"
		add_child(collision_body)
	var cs := CollisionShape3D.new()
	cs.shape = mesh.create_trimesh_shape()
	collision_body.add_child(cs)


func centre_edge(i: int, off: float) -> Vector3:
	return points[i] + rights[i] * off + Vector3.UP * (-banks[i] * off + ROAD_LIFT)


func centre_strip_mesh(width: float, color_a: Color, color_b: Color, dash := false) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var vi := 0
	for i in SAMPLES:
		var j := (i + 1) % SAMPLES
		if dash and (int(i / 12) % 2) == 1:
			continue
		var a := centre_edge(i, -width * 0.5)
		var b := centre_edge(i, width * 0.5)
		var c := centre_edge(j, width * 0.5)
		var d := centre_edge(j, -width * 0.5)
		var col := color_a if (int(i / 8) % 2) == 0 else color_b
		for v in [a, b, c, d]:
			st.set_color(col)
			st.add_vertex(v)
		st.add_index(vi); st.add_index(vi + 1); st.add_index(vi + 2)
		st.add_index(vi); st.add_index(vi + 2); st.add_index(vi + 3)
		vi += 4
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.7
	mesh.surface_set_material(0, mat)
	return mesh


func build_curbs_and_lines() -> void:
	var red := Color(0.78, 0.09, 0.10)
	var white := Color(0.92, 0.94, 0.96)
	add_mesh(strip_mesh(0.9, -1, 0.0, red, white), "LeftCurb")
	add_mesh(strip_mesh(0.9, 1, 0.0, red, white), "RightCurb")
	var line := Color(0.86, 0.88, 0.90)
	add_mesh(strip_mesh(0.16, -1, -1.25, line, line), "LeftEdgeLine")
	add_mesh(strip_mesh(0.16, 1, -1.25, line, line), "RightEdgeLine")
	add_mesh(centre_strip_mesh(0.16, white, white, true), "CentreLine")


func start_point(off: float, along: float) -> Vector3:
	return points[0] + rights[0] * off + tangents[0] * along + Vector3.UP * (-banks[0] * off + 0.02)


func build_start_line() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var cols := 14
	var vi := 0
	for row in 2:
		for c in cols:
			var o0 := -HALF_ROAD + float(c) / float(cols) * ROAD_WIDTH
			var o1 := -HALF_ROAD + float(c + 1) / float(cols) * ROAD_WIDTH
			var a0 := -1.1 + float(row) * 1.1
			var a1 := a0 + 1.1
			var col := Color(0.96, 0.97, 0.98) if (c + row) % 2 == 0 else Color(0.03, 0.04, 0.05)
			for p in [start_point(o0, a0), start_point(o1, a0), start_point(o1, a1), start_point(o0, a1)]:
				st.set_color(col)
				st.add_vertex(p)
			st.add_index(vi); st.add_index(vi + 1); st.add_index(vi + 2)
			st.add_index(vi); st.add_index(vi + 2); st.add_index(vi + 3)
			vi += 4
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.7
	mesh.surface_set_material(0, mat)
	add_mesh(mesh, "StartFinishLine")
	var gantry_mat := StandardMaterial3D.new()
	gantry_mat.albedo_color = Color(0.08, 0.10, 0.13)
	gantry_mat.metallic = 0.5
	for side in [-1, 1]:
		var post := MeshInstance3D.new()
		var post_mesh := BoxMesh.new()
		post_mesh.size = Vector3(0.28, 5.2, 0.28)
		post_mesh.material = gantry_mat
		post.mesh = post_mesh
		post.position = start_point(float(side) * (HALF_ROAD + 0.7), 0.0) + Vector3.UP * 2.6
		post.rotation.y = atan2(tangents[0].x, tangents[0].z)
		post.material_override = gantry_mat
		add_child(post)
	var beam := MeshInstance3D.new()
	var beam_mesh := BoxMesh.new()
	beam_mesh.size = Vector3(ROAD_WIDTH + 2.4, 0.42, 0.3)
	beam_mesh.material = gantry_mat
	beam.mesh = beam_mesh
	beam.position = start_point(0.0, 0.0) + Vector3.UP * 5.0
	beam.rotation.y = atan2(tangents[0].x, tangents[0].z)
	beam.material_override = gantry_mat
	add_child(beam)


func terrain_height(x: float, z: float) -> float:
	return -3.0 + sin(x * 0.017) * 5.0 + cos(z * 0.021) * 4.0 + sin((x + z) * 0.009) * 7.0


func nearest_track_xz(x: float, z: float) -> Array:
	var best := 0
	var best_d := INF
	var p := Vector2(x, z)
	for i in range(0, SAMPLES, 3):
		var q := Vector2(points[i].x, points[i].z)
		var d := p.distance_squared_to(q)
		if d < best_d:
			best_d = d
			best = i
	for k in range(-5, 6):
		var i := (best + k + SAMPLES) % SAMPLES
		var q := Vector2(points[i].x, points[i].z)
		var d := p.distance_squared_to(q)
		if d < best_d:
			best_d = d
			best = i
	return [best, best_d]


func ground_height(x: float, z: float) -> float:
	# Raw noise used to poke through the asphalt wherever the road went into a
	# valley. Keep the ground below the nearest piece of road for the whole
	# visible corridor, then let the hills take over farther out.
	var raw := terrain_height(x, z)
	var near: Array = nearest_track_xz(x, z)
	var road_y: float = points[int(near[0])].y
	var dist := sqrt(float(near[1]))
	var cap := road_y - 0.6 + maxf(0.0, dist - 12.0) * 0.05
	return minf(raw, cap)


func build_embankments() -> void:
	for side in [-1, 1]:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var vi := 0
		for i in SAMPLES:
			var j := (i + 1) % SAMPLES
			var a := edge(i, side, 0.9)
			var b := edge(j, side, 0.9)
			var far_a := edge(i, side, 26.0)
			var far_b := edge(j, side, 26.0)
			far_a.y = ground_height(far_a.x, far_a.z)
			far_b.y = ground_height(far_b.x, far_b.z)
			for v in [a, b, far_b, far_a]:
				st.set_color(Color(0.13, 0.18, 0.12))
				st.add_vertex(v)
			st.add_index(vi); st.add_index(vi + 1); st.add_index(vi + 2)
			st.add_index(vi); st.add_index(vi + 2); st.add_index(vi + 3)
			vi += 4
		st.generate_normals()
		var mesh := st.commit()
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.roughness = 1.0
		mesh.surface_set_material(0, mat)
		add_mesh(mesh, "Embankment%d" % side)


func build_terrain() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var segments := 90
	var span := 620.0
	var vi := 0
	for z in segments:
		for x in segments:
			var x0 := -span * 0.5 + float(x) / float(segments - 1) * span
			var z0 := -span * 0.5 + float(z) / float(segments - 1) * span + 100.0
			var x1 := -span * 0.5 + float(x + 1) / float(segments - 1) * span
			var z1 := -span * 0.5 + float(z) / float(segments - 1) * span + 100.0
			var x2 := x1
			var z2 := -span * 0.5 + float(z + 1) / float(segments - 1) * span + 100.0
			var x3 := x0
			var z3 := z2
			var quad: Array[Vector3] = [Vector3(x0, ground_height(x0, z0), z0), Vector3(x1, ground_height(x1, z1), z1), Vector3(x2, ground_height(x2, z2), z2), Vector3(x3, ground_height(x3, z3), z3)]
			for p in quad:
				var shade: float = clampf((p.y + 14.0) / 30.0, 0.0, 1.0)
				st.set_color(Color(0.09 + shade * 0.08, 0.16 + shade * 0.11, 0.08 + shade * 0.05))
				st.add_vertex(p)
			st.add_index(vi); st.add_index(vi + 1); st.add_index(vi + 2)
			st.add_index(vi); st.add_index(vi + 2); st.add_index(vi + 3)
			vi += 4
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mesh.surface_set_material(0, mat)
	add_mesh(mesh, "Terrain")


func build_guardrails() -> void:
	var rail_mat := StandardMaterial3D.new()
	rail_mat.albedo_color = Color(0.42, 0.46, 0.50)
	rail_mat.metallic = 0.7
	rail_mat.roughness = 0.4
	var post_mesh := BoxMesh.new()
	post_mesh.size = Vector3(0.16, 1.0, 0.16)
	post_mesh.material = rail_mat
	var beam_mesh := BoxMesh.new()
	beam_mesh.size = Vector3(0.14, 0.28, 7.0)
	beam_mesh.material = rail_mat
	var count := SAMPLES / 8
	var posts := MultiMesh.new()
	posts.transform_format = MultiMesh.TRANSFORM_3D
	posts.mesh = post_mesh
	posts.instance_count = count * 2
	var beams := MultiMesh.new()
	beams.transform_format = MultiMesh.TRANSFORM_3D
	beams.mesh = beam_mesh
	beams.instance_count = count * 2
	var pi := 0
	var bi := 0
	for i in range(0, SAMPLES, 8):
		var j := (i + 8) % SAMPLES
		for side in [-1, 1]:
			var p := edge(i, side, 1.25) + Vector3.UP * 0.45
			var basis := Basis(rights[i], Vector3.UP, -tangents[i]).orthonormalized()
			posts.set_instance_transform(pi, Transform3D(basis, p))
			pi += 1
			var mid := (edge(i, side, 1.25) + edge(j, side, 1.25)) * 0.5 + Vector3.UP * 0.75
			var beam_basis := Basis(rights[i], Vector3.UP, tangents[i]).orthonormalized()
			beams.set_instance_transform(bi, Transform3D(beam_basis, mid))
			bi += 1
	var post_mi := MultiMeshInstance3D.new()
	post_mi.multimesh = posts
	post_mi.material_override = rail_mat
	add_child(post_mi)
	var beam_mi := MultiMeshInstance3D.new()
	beam_mi.multimesh = beams
	beam_mi.material_override = rail_mat
	add_child(beam_mi)


func build_guardrail_collision() -> void:
	var step := 6
	for i in range(0, SAMPLES, step):
		var j := (i + step) % SAMPLES
		for side in [-1, 1]:
			var a := edge(i, side, 1.25)
			var b := edge(j, side, 1.25)
			var mid := (a + b) * 0.5
			var seg_len := a.distance_to(b)
			var basis := Basis(rights[i], Vector3.UP, -tangents[i]).orthonormalized()
			var box := BoxShape3D.new()
			box.size = Vector3(0.24, 1.15, seg_len + 0.8)
			var cs := CollisionShape3D.new()
			cs.shape = box
			cs.transform = Transform3D(basis, mid + Vector3.UP * 0.55)
			collision_body.add_child(cs)


func build_scenery() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 4224
	var trunk_mat := StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.18, 0.11, 0.06)
	var crown_mat := StandardMaterial3D.new()
	crown_mat.albedo_color = Color(0.07, 0.20, 0.09)
	crown_mat.roughness = 0.95
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.16
	trunk_mesh.bottom_radius = 0.24
	trunk_mesh.height = 2.6
	trunk_mesh.material = trunk_mat
	var crown_mesh := CylinderMesh.new()
	crown_mesh.top_radius = 0.0
	crown_mesh.bottom_radius = 1.7
	crown_mesh.height = 6.0
	crown_mesh.material = crown_mat
	var trunks := MultiMesh.new(); trunks.transform_format = MultiMesh.TRANSFORM_3D; trunks.mesh = trunk_mesh
	var crowns := MultiMesh.new(); crowns.transform_format = MultiMesh.TRANSFORM_3D; crowns.mesh = crown_mesh
	var tree_count := 360
	trunks.instance_count = tree_count
	crowns.instance_count = tree_count
	for i in tree_count:
		var s := rng.randi_range(0, SAMPLES - 1)
		var side := 1 if rng.randf() > 0.5 else -1
		var dist := rng.randf_range(16.0, 52.0)
		var base := edge(s, side, dist)
		base.y = ground_height(base.x, base.z)
		var scale := rng.randf_range(0.7, 1.5)
		var rot := Basis(Vector3.UP, rng.randf_range(0.0, TAU))
		trunks.set_instance_transform(i, Transform3D(rot.scaled(Vector3(scale, scale, scale)), base + Vector3.UP * 1.3 * scale))
		crowns.set_instance_transform(i, Transform3D(rot.scaled(Vector3(scale, scale, scale)), base + Vector3.UP * 5.0 * scale))
	var tm := MultiMeshInstance3D.new(); tm.multimesh = trunks; tm.material_override = trunk_mat; add_child(tm)
	var cm := MultiMeshInstance3D.new(); cm.multimesh = crowns; cm.material_override = crown_mat; add_child(cm)
	var rock_mat := StandardMaterial3D.new()
	rock_mat.albedo_color = Color(0.30, 0.30, 0.32)
	rock_mat.roughness = 1.0
	var rock_mesh := SphereMesh.new()
	rock_mesh.radius = 1.0
	rock_mesh.height = 1.4
	rock_mesh.rings = 4
	rock_mesh.radial_segments = 6
	rock_mesh.material = rock_mat
	var rocks := MultiMesh.new(); rocks.transform_format = MultiMesh.TRANSFORM_3D; rocks.mesh = rock_mesh
	var rock_count := 120
	rocks.instance_count = rock_count
	for i in rock_count:
		var s := rng.randi_range(0, SAMPLES - 1)
		var side := 1 if rng.randf() > 0.5 else -1
		var base := edge(s, side, rng.randf_range(8.0, 22.0))
		base.y = ground_height(base.x, base.z) + 0.3
		var sc := rng.randf_range(0.4, 1.8)
		rocks.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(sc, sc * 0.6, sc)), base))
	var rm := MultiMeshInstance3D.new(); rm.multimesh = rocks; rm.material_override = rock_mat; add_child(rm)


func build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.09, 0.20, 0.42)
	sky_mat.sky_horizon_color = Color(0.62, 0.72, 0.82)
	sky_mat.ground_bottom_color = Color(0.12, 0.14, 0.13)
	sky_mat.ground_horizon_color = Color(0.48, 0.50, 0.46)
	sky_mat.sun_angle_max = 18.0
	sky_mat.sun_curve = 0.12
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.55
	env.fog_enabled = true
	env.fog_light_color = Color(0.55, 0.65, 0.75)
	env.fog_density = 0.0018
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.05
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_color = Color(1.0, 0.92, 0.78)
	sun.light_energy = 2.6
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 260.0
	sun.shadow_bias = 0.04
	sun.rotation_degrees = Vector3(-42, -28, 0)
	add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.name = "SkyFill"
	fill.light_color = Color(0.42, 0.58, 0.86)
	fill.light_energy = 0.5
	fill.shadow_enabled = false
	fill.rotation_degrees = Vector3(-20, 150, 0)
	add_child(fill)
	env.glow_enabled = true
	env.glow_intensity = 0.42
	env.glow_hdr_threshold = 0.85
	env.glow_strength = 1.0
	env.glow_bloom = 0.35


func sample(index: int) -> Vector3:
	return points[index % SAMPLES]


func nearest_index(pos: Vector3) -> int:
	var best := 0
	var best_d := INF
	for i in range(0, SAMPLES, 3):
		var d := points[i].distance_squared_to(pos)
		if d < best_d:
			best_d = d
			best = i
	return best


func progress(pos: Vector3) -> float:
	return float(nearest_index(pos)) / float(SAMPLES)
