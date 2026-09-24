// src/modules/languages/application/languages.service.ts

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Language } from '@prisma/client';
import { ILanguageRepository, LanguageFilters } from '../domain/languages.repository';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { UpdateLanguageDto } from '../dto/update-language.dto';
import { LanguageNotFoundException, LanguageDuplicateException } from '@/common/exceptions';

@Injectable()
export class LanguagesService {
  constructor(
    @Inject('ILanguageRepository')
    private readonly languageRepository: ILanguageRepository,
  ) {}

  /**
   * Get all languages with optional filters
   */
  async findAll(filters?: LanguageFilters): Promise<Language[]> {
    return this.languageRepository.findAll(filters);
  }

  /**
   * Get a single language by ID
   */
  async findOne(id: number): Promise<Language> {
    const language = await this.languageRepository.findById(id);

    if (!language) {
      throw new LanguageNotFoundException(id);
    }

    return language;
  }

  /**
   * Get a language by code
   */
  async findByCode(code: string): Promise<Language> {
    const language = await this.languageRepository.findByCode(code);

    if (!language) {
      throw new LanguageNotFoundException(code);
    }

    return language;
  }

  /**
   * Get active languages
   */
  async findActive(): Promise<Language[]> {
    return this.languageRepository.findActive();
  }

  /**
   * Get default language
   */
  async findDefault(): Promise<Language> {
    const language = await this.languageRepository.findDefault();

    if (!language) {
      throw new LanguageNotFoundException('default');
    }

    return language;
  }

  /**
   * Create a new language
   */
  async create(dto: CreateLanguageDto): Promise<Language> {
    // Check if code already exists
    const codeExists = await this.languageRepository.codeExists(dto.code);

    if (codeExists) {
      throw new LanguageDuplicateException(dto.code);
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.unsetAllDefaults();
    }

    return this.languageRepository.create({
      code: dto.code,
      name: dto.name,
      englishName: dto.englishName,
      georgianName: dto.georgianName,
      flagEmoji: dto.flagEmoji,
      direction: dto.direction ?? 'ltr',
      isActive: dto.isActive ?? true,
      isDefault: dto.isDefault ?? false,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  /**
   * Update a language
   */
  async update(id: number, dto: UpdateLanguageDto): Promise<Language> {
    // Check if language exists
    await this.findOne(id);

    // Check if code is being changed and if it already exists
    if (dto.code) {
      const codeExists = await this.languageRepository.codeExists(dto.code, id);

      if (codeExists) {
        throw new LanguageDuplicateException(dto.code);
      }
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.unsetAllDefaults();
    }

    return this.languageRepository.update(id, dto);
  }

  /**
   * Delete a language
   */
  async remove(id: number): Promise<void> {
    const language = await this.findOne(id);

    // Prevent deleting default language
    if (language.isDefault) {
      throw new BadRequestException('Cannot delete the default language');
    }

    // Check if language has translations
    const hasTranslations = await this.hasTranslations(id);
    if (hasTranslations) {
      throw new BadRequestException(
        'Cannot delete language with existing translations. Please delete or reassign translations first.',
      );
    }

    await this.languageRepository.delete(id);
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number): Promise<Language> {
    const language = await this.findOne(id);

    // Prevent deactivating default language
    if (language.isDefault && language.isActive) {
      throw new BadRequestException('Cannot deactivate the default language');
    }

    return this.languageRepository.toggleActive(id);
  }

  /**
   * Get language statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    defaultLanguage: Language | null;
  }> {
    const [total, active, defaultLanguage] = await Promise.all([
      this.languageRepository.count(),
      this.languageRepository.count({ isActive: true }),
      this.languageRepository.findDefault(),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      defaultLanguage,
    };
  }

  /**
   * Unset all default languages (internal helper)
   */
  private async unsetAllDefaults(): Promise<void> {
    const currentDefault = await this.languageRepository.findDefault();
    if (currentDefault) {
      await this.languageRepository.update(currentDefault.id, {
        isDefault: false,
      });
    }
  }

  /**
   * Check if language has translations (internal helper)
   */
  private async hasTranslations(_languageId: number): Promise<boolean> {
    // This would need to check all translation tables
    // For now, return false
    // TODO: Implement when translation modules are ready
    return false;
  }
}
