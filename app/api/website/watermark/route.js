import { prisma } from "../../../lib/prisma";


export async function POST(req) {
  try {
    const data = await req.json();

    // Basic validation
    if (!data) {
      return Response.json(
        { success: false, message: "No data provided" },
        { status: 400 }
      );
    }

    // Get single website row
    const website = await prisma.website.findFirst();

    if (!website) {
      return Response.json(
        { success: false, message: "Website not found" },
        { status: 404 }
      );
    }

    // Update watermark JSON
    const updated = await prisma.website.update({
      where: {
        id: website.id,
      },
      data: {
        watermark: {
          enabled: data.enabled ?? false,
          text: data.text ?? "",
          position: data.position ?? "center",
          opacity: data.opacity ?? 30,
          fontSize: data.fontSize ?? 24,
          color: data.color ?? "#ffffff",
        },
      },
    });
await prisma.log.create({
  data: {
    who: "api:watermark",
    content: `Watermark updated: cdrlogo.com`,
  },
});
    return Response.json({
      success: true,
      message: "Watermark saved successfully",
      data: updated.watermark,
    });

  } catch (error) {
    console.error("Watermark API Error:", error);

    return Response.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}


export async function GET() {
  try {
    const website = await prisma.website.findFirst();

    if (!website) {
      return Response.json(
        { success: false, message: "Website not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: website.watermark || {
        enabled: false,
        text: "CDRLOGO.com",
        position: "center",
        opacity: 30,
        fontSize: 24,
        color: "#ffffff",
      },
    });

  } catch (error) {
    console.error("GET Watermark Error:", error);

    return Response.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}