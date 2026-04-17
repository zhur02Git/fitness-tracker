export async function GET() {
  return Response.json([
    { exercise: "Bench Press", weight: 80, reps: 8 }
  ])
}