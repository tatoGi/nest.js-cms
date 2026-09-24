-- CreateTable
CREATE TABLE "role_management" (
    "id" SERIAL NOT NULL,
    "manager_role_slug" VARCHAR(255) NOT NULL,
    "managed_role_slug" VARCHAR(255) NOT NULL,

    CONSTRAINT "role_management_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_management_manager_role_slug_managed_role_slug_key" ON "role_management"("manager_role_slug", "managed_role_slug");

-- AddForeignKey
ALTER TABLE "role_management" ADD CONSTRAINT "role_management_manager_role_slug_fkey" FOREIGN KEY ("manager_role_slug") REFERENCES "roles"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_management" ADD CONSTRAINT "role_management_managed_role_slug_fkey" FOREIGN KEY ("managed_role_slug") REFERENCES "roles"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
