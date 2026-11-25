extends Node3D
class_name RaceTrack

## Procedural circuit: Catmull-Rom centreline, banked asphalt, variable-width
## corners, curbs, painted lines, runoff, guardrails, pit complex, grandstands,
## embankments, terrain, trees, rocks and distance markers. Everything is
## generated in Godot at runtime - no HTML, no JavaScript, no external assets.

const SAMPLES := 960
const ROAD_WIDTH := 14.0
const BASE_HALF := ROAD_WIDTH * 0.5
const ROAD_LIFT := 0.04
const SHOULDER := 1.8

var points: Array[Vector3] = []
var tangents: Array[Vector3] = []
var rights: Array[Vector3] = []
var banks: Array[float] = []
var widths: Array[float] = []
var length := 0.0

var road_mesh: ArrayMesh
var collision_body: StaticBody3D


func _ready() -> void:
	build_spline()
	build_road()
	build_curbs_and_lines()
	build_start_line()
	build_runoff()
	build_embankments()
	build_terrain()
	build_guardrails()
	build_guardrail_collision()
	build_pit_complex()
	build_scenery()
	build_environment()


func build_spline() -> void:
	# A mountain-coast circuit with a long opening straight, a fast downhill
	# sweeper, a tight inland hairpin and a climbing final section.
	var control := [
		Vector3(0, 1, 0),
		Vector3(85, 2, -6),
		Vector3(150, 6, -42),
		Vector3(178, 14, -105),
		Vector3(150, 20, -168),
		Vector3(98, 16, -214),
		Vector3(28, 8, -226),
		Vector3(-18, 4, -202),
		Vector3(-28, 4, -160),
		Vector3(-78, 8, -140),
		Vector3(-132, 16, -104),
		Vector3(-154, 20, -44),
		Vector3(-118, 12, 2),
		Vector3(-58, 4, 12),
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
		rights.append(tan.cross(Vector3.UP).normalized())
	for i in SAMPLES:
		var prev_tan: Vector3 = tangents[(i - 1 + SAMPLES) % SAMPLES]
		var tan: Vector3 = tangents[i]
		var cross_y := prev_tan.x * tan.z - prev_tan.z * tan.x
		banks.append(clampf(cross_y * 16.0, -0.15, 0.15))
	# Corners are wider than straights, like a real circuit.
	for i in SAMPLES:
		var curve: float = absf(banks[i]) / 0.15
		var sweep: float = 0.45 * sin(float(i) / float(SAMPLES) * TAU * 3.0)
		widths.append(ROAD_WIDTH + curve * 2.2 + sweep)
	length = 0.0
	for i in SAMPLES:
		length += points[i].distance_to(points[(i + 1) % SAMPLES])


func catmull(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: float) -> Vector3:
	var t2 := t * t
	var t3 := t2 * t
	return 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)


func half_width(i: int) -> float:
	if widths.is_empty():
		return BASE_HALF
	return widths[i % SAMPLES] * 0.5


func edge(i: int, side: int, extra := 0.0) -> Vector3:
	var idx := i % SAMPLES
	var off := half_width(idx) + extra
	var p: Vector3 = points[idx]
	var r: Vector3 = rights[idx]
	var b: float = banks[idx]
	return p + r * (off * float(side)) + Vector3.UP * (-b * off * float(side) + ROAD_LIFT)


func centre_edge(i: int, off: float) -> Vector3:
	var idx := i % SAMPLES
	return points[idx] + rights[idx] * off + Vector3.UP * (-banks[idx] * off + ROAD_LIFT)


func bank_basis(i: int) -> Basis:
	var idx := i % SAMPLES
	var r: Vector3 = rights[idx].normalized()
	var b: float = banks[idx]
	var x := (r - Vector3.UP * b).normalized()
	var y := (Vector3.UP + r * b).normalized()
	var z := -tangents[idx].normalized()
	return Basis(x, y, z).orthonormalized()


func add_quad(st: SurfaceTool, vi: int, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3,
		c0: Color, c1: Color, c2: Color, c3: Color, uvs: Array[Vector2] = []) -> void:
	var pts := [p0, p1, p2, p3]
	var cols := [c0, c1, c2, c3]
	for k in 4:
		if uvs.size() == 4:
			st.set_uv(uvs[k])
		st.set_color(cols[k])
		st.add_vertex(pts[k])
	var n := (p1 - p0).cross(p2 - p0)
	if n.dot(Vector3.UP) < 0.0:
		st.add_index(vi); st.add_index(vi + 2); st.add_index(vi + 1)
		st.add_index(vi); st.add_index(vi + 3); st.add_index(vi + 2)
	else:
		st.add_index(vi); st.add_index(vi + 1); st.add_index(vi + 2)
		st.add_index(vi); st.add_index(vi + 2); st.add_index(vi + 3)


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


func add_box(name: String, size: Vector3, pos: Vector3, mat: Material, basis := Basis()) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = name
	var box := BoxMesh.new()
	box.size = size
	box.material = mat
	mi.mesh = box
	mi.transform = Transform3D(basis, pos)
	mi.material_override = mat
	add_child(mi)
	return mi


func build_road() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in SAMPLES:
		var j := (i + 1) % SAMPLES
		var l0 := edge(i, -1)
		var r0 := edge(i, 1)
		var l1 := edge(j, -1)
		var r1 := edge(j, 1)
		var u0 := float(i) / float(SAMPLES) * 48.0
		var u1 := float(i + 1) / float(SAMPLES) * 48.0
		var shade: float = 0.94 + sin(i * 0.41) * 0.025 + cos(i * 0.17) * 0.02
		var col := Color(shade, shade, shade)
		var uvs: Array[Vector2] = [Vector2(0, u0), Vector2(1, u0), Vector2(1, u1), Vector2(0, u1)]
		add_quad(st, i * 4, l0, r0, r1, l1, col, col, col, col, uvs)
	st.generate_normals()
	road_mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.31, 0.33, 0.36)
	mat.roughness = 0.94
	mat.metallic = 0.02
	mat.vertex_color_use_as_albedo = true
	var grain := FastNoiseLite.new()
	grain.noise_type = FastNoiseLite.TYPE_PERLIN
	grain.frequency = 0.55
	var grain_tex := NoiseTexture2D.new()
	grain_tex.noise = grain
	grain_tex.width = 256
	grain_tex.height = 256
	grain_tex.seamless = true
	mat.albedo_texture = grain_tex
	var rough_noise := FastNoiseLite.new()
	rough_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	rough_noise.frequency = 1.8
	var rough_tex := NoiseTexture2D.new()
	rough_tex.noise = rough_noise
	rough_tex.width = 128
	rough_tex.height = 128
	rough_tex.seamless = true
	mat.roughness_texture = rough_tex
	road_mesh.surface_set_material(0, mat)
	add_mesh(road_mesh, "Asphalt")

	collision_body = StaticBody3D.new()
	collision_body.name = "CircuitCollision"
	add_child(collision_body)
	build_road_collision()


func build_road_collision() -> void:
	# Overlapping banked slabs form a continuous surface. Each slab's top face
	# matches the visible banking exactly, including the shoulders under the
	# curbs, so a wheel can never drop into a seam at speed.
	var step := 1
	for i in range(0, SAMPLES, step):
		var j := (i + step) % SAMPLES
		var mid := (points[i] + points[j]) * 0.5
		var seg_len := points[i].distance_to(points[j])
		var basis := bank_basis(i)
		var box := BoxShape3D.new()
		box.size = Vector3(half_width(i) * 2.0 + SHOULDER * 2.0, 0.7, seg_len + 0.45)
		var cs := CollisionShape3D.new()
		cs.shape = box
		cs.transform = Transform3D(basis, mid + Vector3.UP * (ROAD_LIFT - 0.35))
		collision_body.add_child(cs)


func strip_mesh(width: float, side: int, extra: float, color_a: Color, color_b: Color, dash := false) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var vi := 0
	for i in SAMPLES:
		var j := (i + 1) % SAMPLES
		if dash and (int(i / 14) % 2) == 1:
			continue
		var a := edge(i, side, extra)
		var b := edge(i, side, extra + width)
		var c := edge(j, side, extra + width)
		var d := edge(j, side, extra)
		var col := color_a if (int(i / 10) % 2) == 0 else color_b
		add_quad(st, vi, a, b, c, d, col, col, col, col)
		vi += 4
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.65
	mesh.surface_set_material(0, mat)
	return mesh


func centre_strip_mesh(width: float, color_a: Color, color_b: Color, dash := false) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var vi := 0
	for i in SAMPLES:
		var j := (i + 1) % SAMPLES
		if dash and (int(i / 14) % 2) == 1:
			continue
		var a := centre_edge(i, -width * 0.5)
		var b := centre_edge(i, width * 0.5)
		var c := centre_edge(j, width * 0.5)
		var d := centre_edge(j, -width * 0.5)
		var col := color_a if (int(i / 10) % 2) == 0 else color_b
		add_quad(st, vi, a, b, c, d, col, col, col, col)
		vi += 4
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.65
	mesh.surface_set_material(0, mat)
	return mesh


func build_curbs_and_lines() -> void:
	var red := Color(0.82, 0.10, 0.11)
	var white := Color(0.94, 0.95, 0.97)
	add_mesh(strip_mesh(0.95, -1, 0.0, red, white), "LeftCurb")
	add_mesh(strip_mesh(0.95, 1, 0.0, red, white), "RightCurb")
	var line := Color(0.90, 0.91, 0.93)
	add_mesh(strip_mesh(0.16, -1, -1.35, line, line), "LeftEdgeLine")
	add_mesh(strip_mesh(0.16, 1, -1.35, line, line), "RightEdgeLine")
	add_mesh(centre_strip_mesh(0.14, white, white, true), "CentreLine")
	# A thin contrasting band just inside each curb reads like track paint.
	var accent := Color(0.16, 0.42, 0.68)
	add_mesh(strip_mesh(0.10, -1, -2.25, accent, accent), "LeftAccent")
	add_mesh(strip_mesh(0.10, 1, -2.25, accent, accent), "RightAccent")


func start_point(off: float, along: float) -> Vector3:
	return points[0] + rights[0] * off + tangents[0] * along + Vector3.UP * (-banks[0] * off + 0.02)


func grid_slot(slot: int) -> Vector3:
	var lane := -2.7 + float(slot % 2) * 5.4
	var row := slot / 2
	return start_point(lane, 4.0 + float(row) * 5.5)


func build_start_line() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var cols := 16
	var vi := 0
	var hw := half_width(0)
	for row in 2:
		for c in cols:
			var o0 := -hw + float(c) / float(cols) * hw * 2.0
			var o1 := -hw + float(c + 1) / float(cols) * hw * 2.0
			var a0 := -1.2 + float(row) * 1.2
			var a1 := a0 + 1.2
			var col := Color(0.97, 0.98, 0.99) if (c + row) % 2 == 0 else Color(0.03, 0.04, 0.05)
			add_quad(st, vi,
				start_point(o0, a0), start_point(o1, a0),
				start_point(o1, a1), start_point(o0, a1),
				col, col, col, col)
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
	gantry_mat.metallic = 0.55
	gantry_mat.roughness = 0.35
	var basis := bank_basis(0)
	for side in [-1, 1]:
		add_box("GantryPost", Vector3(0.30, 5.4, 0.30),
			start_point(float(side) * (hw + 0.9), 0.0) + Vector3.UP * 2.7, gantry_mat, basis)
	add_box("GantryBeam", Vector3(hw * 2.0 + 2.4, 0.46, 0.34),
		start_point(0.0, 0.0) + Vector3.UP * 5.2, gantry_mat, basis)
	# Painted grid slots behind the line.
	var grid_mat := StandardMaterial3D.new()
	grid_mat.albedo_color = Color(0.88, 0.90, 0.92)
	grid_mat.roughness = 0.75
	for slot in 4:
		var p := grid_slot(slot)
		add_box("GridSlot", Vector3(1.0, 0.012, 3.4), p + Vector3.UP * 0.015, grid_mat, basis)


func terrain_height(x: float, z: float) -> float:
	var h := -2.0
	h += sin(x * 0.013) * 4.5
	h += cos(z * 0.017) * 4.0
	h += sin((x + z) * 0.008) * 5.0
	h += sin((x - z) * 0.011) * 2.5
	h += cos(x * 0.031 + z * 0.019) * 1.4
	return h


func nearest_track_xz(x: float, z: float) -> Array:
	var best := 0
	var best_d := INF
	var p := Vector2(x, z)
	for i in range(0, SAMPLES, 2):
		var q := Vector2(points[i].x, points[i].z)
		var d := p.distance_squared_to(q)
		if d < best_d:
			best_d = d
			best = i
	for k in range(-8, 9):
		var i := (best + k + SAMPLES) % SAMPLES
		var q := Vector2(points[i].x, points[i].z)
		var d := p.distance_squared_to(q)
		if d < best_d:
			best_d = d
			best = i
	return [best, best_d]


func ground_height(x: float, z: float) -> float:
	var raw := terrain_height(x, z)
	var near: Array = nearest_track_xz(x, z)
	var idx := int(near[0])
	var road_y: float = points[idx].y
	var dist := sqrt(float(near[1]))
	var cap := road_y - 1.0 + maxf(0.0, dist - half_width(idx) - 3.0) * 0.09
	return minf(raw, cap)


func build_runoff() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var vi := 0
	for i in SAMPLES:
		var j := (i + 1) % SAMPLES
		for side in [-1, 1]:
			var a := edge(i, side, 1.0)
			var b := edge(j, side, 1.0)
			var c := edge(j, side, 5.2)
			var d := edge(i, side, 5.2)
			var shade: float = 0.8 + 0.12 * sin(float(i) * 0.07 + float(side))
			var col := Color(0.36 * shade, 0.33 * shade, 0.27 * shade)
			add_quad(st, vi, a, b, c, d, col, col, col, col)
			vi += 4
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mesh.surface_set_material(0, mat)
	add_mesh(mesh, "Runoff")


func build_embankments() -> void:
	for side in [-1, 1]:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var vi := 0
		for i in SAMPLES:
			var j := (i + 1) % SAMPLES
			var a := edge(i, side, 1.3)
			var b := edge(j, side, 1.3)
			var far_a := edge(i, side, 32.0)
			var far_b := edge(j, side, 32.0)
			far_a.y = ground_height(far_a.x, far_a.z)
			far_b.y = ground_height(far_b.x, far_b.z)
			var shade: float = clampf((a.y - far_a.y + 6.0) / 22.0, 0.0, 1.0)
			var col := Color(0.12 + shade * 0.06, 0.18 + shade * 0.10, 0.10 + shade * 0.05)
			add_quad(st, vi, a, b, far_b, far_a, col, col, col, col)
			vi += 4
		st.generate_normals()
		var mesh := st.commit()
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.roughness = 1.0
		mesh.surface_set_material(0, mat)
		add_mesh(mesh, "Embankment%d" % side)
		add_collision(mesh)


func build_terrain() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var segments := 84
	var span := 760.0
	var z_offset := -90.0
	var vi := 0
	for z in segments:
		for x in segments:
			var x0 := -span * 0.5 + float(x) / float(segments - 1) * span
			var x1 := -span * 0.5 + float(x + 1) / float(segments - 1) * span
			var z0 := z_offset - span * 0.5 + float(z) / float(segments - 1) * span
			var z1 := z_offset - span * 0.5 + float(z + 1) / float(segments - 1) * span
			var p0 := Vector3(x0, ground_height(x0, z0), z0)
			var p1 := Vector3(x1, ground_height(x1, z0), z0)
			var p2 := Vector3(x1, ground_height(x1, z1), z1)
			var p3 := Vector3(x0, ground_height(x0, z1), z1)
			var cols: Array[Color] = []
			for p in [p0, p1, p2, p3]:
				var shade: float = clampf((p.y + 16.0) / 34.0, 0.0, 1.0)
				cols.append(Color(0.09 + shade * 0.09, 0.16 + shade * 0.12, 0.08 + shade * 0.06))
			add_quad(st, vi, p0, p1, p2, p3, cols[0], cols[1], cols[2], cols[3])
			vi += 4
	st.generate_normals()
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mesh.surface_set_material(0, mat)
	add_mesh(mesh, "Terrain")
	add_collision(mesh)


func build_guardrails() -> void:
	var rail_mat := StandardMaterial3D.new()
	rail_mat.albedo_color = Color(0.48, 0.52, 0.56)
	rail_mat.metallic = 0.72
	rail_mat.roughness = 0.38
	var post_mesh := BoxMesh.new()
	post_mesh.size = Vector3(0.18, 1.05, 0.18)
	post_mesh.material = rail_mat
	var beam_mesh := BoxMesh.new()
	beam_mesh.size = Vector3(0.16, 0.30, 8.4)
	beam_mesh.material = rail_mat
	var step := 6
	var count := SAMPLES / step
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
	for i in range(0, SAMPLES, step):
		var j := (i + step) % SAMPLES
		var basis := bank_basis(i)
		for side in [-1, 1]:
			var p := edge(i, side, 1.85) + Vector3.UP * 0.48
			posts.set_instance_transform(pi, Transform3D(basis, p))
			pi += 1
			var mid := (edge(i, side, 1.85) + edge(j, side, 1.85)) * 0.5 + Vector3.UP * 0.78
			beams.set_instance_transform(bi, Transform3D(basis, mid))
			bi += 1
	var post_mi := MultiMeshInstance3D.new()
	post_mi.name = "GuardrailPosts"
	post_mi.multimesh = posts
	post_mi.material_override = rail_mat
	add_child(post_mi)
	var beam_mi := MultiMeshInstance3D.new()
	beam_mi.name = "GuardrailBeams"
	beam_mi.multimesh = beams
	beam_mi.material_override = rail_mat
	add_child(beam_mi)


func build_guardrail_collision() -> void:
	var step := 3
	for i in range(0, SAMPLES, step):
		var j := (i + step) % SAMPLES
		for side in [-1, 1]:
			var a := edge(i, side, 1.85)
			var b := edge(j, side, 1.85)
			var mid := (a + b) * 0.5
			var seg_len := a.distance_to(b)
			var basis := bank_basis(i)
			var box := BoxShape3D.new()
			box.size = Vector3(0.28, 1.25, seg_len + 1.2)
			var cs := CollisionShape3D.new()
			cs.shape = box
			cs.transform = Transform3D(basis, mid + Vector3.UP * 0.60)
			collision_body.add_child(cs)


func build_pit_complex() -> void:
	var basis := bank_basis(0)
	var hw := half_width(0)
	var concrete := StandardMaterial3D.new()
	concrete.albedo_color = Color(0.42, 0.43, 0.44)
	concrete.roughness = 0.92
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.06, 0.07, 0.09)
	dark.roughness = 0.55
	var seat := StandardMaterial3D.new()
	seat.albedo_color = Color(0.12, 0.22, 0.42)
	seat.roughness = 0.8
	var accent := StandardMaterial3D.new()
	accent.albedo_color = Color(0.05, 0.48, 0.78)
	accent.emission = Color(0.02, 0.20, 0.36)
	accent.emission_energy = 0.8

	# Grandstand on the outside of the main straight.
	var stand := start_point(-(hw + 17.0), -4.0)
	for row in 5:
		var p := stand + Vector3.UP * (0.5 + float(row) * 0.85) + rights[0] * (-float(row) * 1.35)
		add_box("GrandstandRow", Vector3(6.0, 0.55, 30.0), p, seat, basis)
	add_box("GrandstandBase", Vector3(9.0, 0.6, 32.0), stand + Vector3.UP * 0.1, concrete, basis)
	add_box("GrandstandRoof", Vector3(10.0, 0.35, 34.0),
		stand + Vector3.UP * 6.4 + rights[0] * -2.8, dark, basis)

	# Pit garages on the opposite side.
	var pit := start_point(hw + 18.0, 12.0)
	add_box("PitBuilding", Vector3(11.0, 5.0, 42.0), pit + Vector3.UP * 2.5, concrete, basis)
	add_box("PitRoof", Vector3(12.0, 0.35, 44.0), pit + Vector3.UP * 5.2, accent, basis)
	for d in 5:
		var along := float(d - 2) * 7.6
		add_box("GarageDoor", Vector3(0.12, 2.7, 5.6),
			pit + rights[0] * -5.6 + tangents[0] * along + Vector3.UP * 1.35, dark, basis)
	var sign := Label3D.new()
	sign.name = "PitSign"
	sign.text = "APEX CIRCUIT"
	sign.font_size = 96
	sign.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sign.modulate = Color(0.35, 0.85, 1.0)
	sign.position = pit + Vector3.UP * 7.2
	add_child(sign)


func build_scenery() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 4224
	var trunk_mat := StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.19, 0.12, 0.07)
	trunk_mat.roughness = 1.0
	var crown_mat := StandardMaterial3D.new()
	crown_mat.albedo_color = Color(0.07, 0.21, 0.10)
	crown_mat.roughness = 0.95
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.16
	trunk_mesh.bottom_radius = 0.26
	trunk_mesh.height = 2.8
	trunk_mesh.material = trunk_mat
	var crown_mesh := CylinderMesh.new()
	crown_mesh.top_radius = 0.0
	crown_mesh.bottom_radius = 1.8
	crown_mesh.height = 6.4
	crown_mesh.material = crown_mat
	var trunks := MultiMesh.new()
	trunks.transform_format = MultiMesh.TRANSFORM_3D
	trunks.mesh = trunk_mesh
	var crowns := MultiMesh.new()
	crowns.transform_format = MultiMesh.TRANSFORM_3D
	crowns.mesh = crown_mesh
	var tree_count := 520
	trunks.instance_count = tree_count
	crowns.instance_count = tree_count
	for i in tree_count:
		var s := rng.randi_range(0, SAMPLES - 1)
		var side := 1 if rng.randf() > 0.5 else -1
		var dist := rng.randf_range(14.0, 58.0)
		var base := edge(s, side, dist)
		base.y = ground_height(base.x, base.z)
		var sc := rng.randf_range(0.7, 1.6)
		var basis := Basis(Vector3.UP, rng.randf_range(0.0, TAU)).scaled(Vector3(sc, sc, sc))
		trunks.set_instance_transform(i, Transform3D(basis, base + Vector3.UP * 1.4 * sc))
		crowns.set_instance_transform(i, Transform3D(basis, base + Vector3.UP * 5.2 * sc))
	var tm := MultiMeshInstance3D.new()
	tm.name = "TreeTrunks"
	tm.multimesh = trunks
	tm.material_override = trunk_mat
	add_child(tm)
	var cm := MultiMeshInstance3D.new()
	cm.name = "TreeCrowns"
	cm.multimesh = crowns
	cm.material_override = crown_mat
	add_child(cm)

	var rock_mat := StandardMaterial3D.new()
	rock_mat.albedo_color = Color(0.32, 0.32, 0.34)
	rock_mat.roughness = 1.0
	var rock_mesh := SphereMesh.new()
	rock_mesh.radius = 1.0
	rock_mesh.height = 1.4
	rock_mesh.rings = 4
	rock_mesh.radial_segments = 6
	rock_mesh.material = rock_mat
	var rocks := MultiMesh.new()
	rocks.transform_format = MultiMesh.TRANSFORM_3D
	rocks.mesh = rock_mesh
	var rock_count := 180
	rocks.instance_count = rock_count
	for i in rock_count:
		var s := rng.randi_range(0, SAMPLES - 1)
		var side := 1 if rng.randf() > 0.5 else -1
		var base := edge(s, side, rng.randf_range(8.0, 26.0))
		base.y = ground_height(base.x, base.z) + 0.3
		var sc := rng.randf_range(0.4, 1.9)
		rocks.set_instance_transform(i, Transform3D(
			Basis().scaled(Vector3(sc, sc * 0.6, sc)), base))
	var rm := MultiMeshInstance3D.new()
	rm.name = "Rocks"
	rm.multimesh = rocks
	rm.material_override = rock_mat
	add_child(rm)

	# Sponsor boards clipped to the guardrails.
	var board_mat := StandardMaterial3D.new()
	board_mat.albedo_color = Color(0.05, 0.32, 0.58)
	board_mat.emission = Color(0.02, 0.16, 0.30)
	board_mat.emission_energy = 0.7
	var board_mesh := BoxMesh.new()
	board_mesh.size = Vector3(0.14, 0.85, 6.4)
	board_mesh.material = board_mat
	var boards := MultiMesh.new()
	boards.transform_format = MultiMesh.TRANSFORM_3D
	boards.mesh = board_mesh
	var board_count := SAMPLES / 24 * 2
	boards.instance_count = board_count
	var bi := 0
	for i in range(0, SAMPLES, 24):
		for side in [-1, 1]:
			var basis := bank_basis(i)
			var p := edge(i, side, 2.35) + Vector3.UP * 0.72
			boards.set_instance_transform(bi, Transform3D(basis, p))
			bi += 1
	var bm := MultiMeshInstance3D.new()
	bm.name = "SponsorBoards"
	bm.multimesh = boards
	bm.material_override = board_mat
	add_child(bm)

	# Distance boards every 100 metres.
	var marker_mat := StandardMaterial3D.new()
	marker_mat.albedo_color = Color(0.94, 0.95, 0.92)
	for i in range(0, SAMPLES, 84):
		var label := Label3D.new()
		label.text = "%d M" % int(float(i) / float(SAMPLES) * length)
		label.font_size = 42
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.modulate = marker_mat.albedo_color
		label.position = edge(i, 1, 4.2) + Vector3.UP * 1.7
		add_child(label)

	# Distant ridges give the horizon some depth.
	var mountain_mat := StandardMaterial3D.new()
	mountain_mat.albedo_color = Color(0.19, 0.24, 0.28)
	mountain_mat.roughness = 1.0
	var mountain_mesh := CylinderMesh.new()
	mountain_mesh.top_radius = 0.0
	mountain_mesh.bottom_radius = 1.0
	mountain_mesh.height = 1.0
	mountain_mesh.radial_segments = 7
	mountain_mesh.material = mountain_mat
	var mountains := MultiMesh.new()
	mountains.transform_format = MultiMesh.TRANSFORM_3D
	mountains.mesh = mountain_mesh
	var mountain_count := 18
	mountains.instance_count = mountain_count
	for i in mountain_count:
		var a := TAU * float(i) / float(mountain_count)
		var radius := 410.0 + rng.randf_range(-25.0, 45.0)
		var h := rng.randf_range(70.0, 155.0)
		var w := rng.randf_range(42.0, 78.0)
		var base := Vector3(cos(a) * radius, ground_height(cos(a) * radius, sin(a) * radius - 90.0), sin(a) * radius - 90.0)
		mountains.set_instance_transform(i, Transform3D(
			Basis().scaled(Vector3(w, h, w)), base + Vector3.UP * h * 0.5))
	var mm := MultiMeshInstance3D.new()
	mm.name = "Mountains"
	mm.multimesh = mountains
	mm.material_override = mountain_mat
	add_child(mm)


func build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.07, 0.17, 0.38)
	sky_mat.sky_horizon_color = Color(0.60, 0.71, 0.82)
	sky_mat.ground_bottom_color = Color(0.10, 0.13, 0.12)
	sky_mat.ground_horizon_color = Color(0.46, 0.49, 0.45)
	sky_mat.sun_angle_max = 16.0
	sky_mat.sun_curve = 0.10
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.60
	env.fog_enabled = true
	env.fog_light_color = Color(0.56, 0.66, 0.76)
	env.fog_density = 0.0012
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.12
	env.glow_enabled = true
	env.glow_intensity = 0.38
	env.glow_hdr_threshold = 0.88
	env.glow_bloom = 0.32
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_color = Color(1.0, 0.93, 0.80)
	sun.light_energy = 2.7
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 280.0
	sun.shadow_bias = 0.035
	sun.rotation_degrees = Vector3(-40, -28, 0)
	add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.name = "SkyFill"
	fill.light_color = Color(0.42, 0.58, 0.86)
	fill.light_energy = 0.55
	fill.shadow_enabled = false
	fill.rotation_degrees = Vector3(-20, 150, 0)
	add_child(fill)


func sample(index: int) -> Vector3:
	return points[index % SAMPLES]


func nearest_index(pos: Vector3) -> int:
	var best := 0
	var best_d := INF
	for i in range(0, SAMPLES, 2):
		var d := points[i].distance_squared_to(pos)
		if d < best_d:
			best_d = d
			best = i
	for k in range(-4, 5):
		var i := (best + k + SAMPLES) % SAMPLES
		var d := points[i].distance_squared_to(pos)
		if d < best_d:
			best_d = d
			best = i
	return best


func index_ahead(index: int, meters: float) -> int:
	var step_len := maxf(length / float(SAMPLES), 0.1)
	return (index + int(round(meters / step_len))) % SAMPLES


func progress(pos: Vector3) -> float:
	return float(nearest_index(pos)) / float(SAMPLES)
