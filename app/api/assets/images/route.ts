import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET(){return NextResponse.json(await prisma.imageAsset.findMany({orderBy:{createdAt:"desc"}}))}
export async function POST(request:Request){const b=await request.json();return NextResponse.json(await prisma.imageAsset.create({data:{name:b.name,url:b.url,altText:b.altText||undefined,category:b.category||undefined}}),{status:201})}
