/**
 * Kubernetes readiness probe target.
 *
 * GDP polls this to decide whether the pod may receive traffic, so it must stay
 * cheap and must NOT require auth or a database round-trip - a DB blip should
 * not take the whole app out of rotation.
 *
 * Set the component's readiness probe path to /api/health in app.yaml
 * (precedent: ocsqui01f0 does exactly this).
 */

export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ status: 'ok', at: new Date().toISOString() })
}
