// B站分区信息 - 根据官方API文档更新，一级主分区
// 名称通过 i18n 动态获取，按当前语言显示
import i18n from '../i18n'

export const BILIBILI_PARTITIONS = [
  { id: 1, name: i18n.t('bilibili.partitions.anime') },
  { id: 4, name: i18n.t('bilibili.partitions.game') },
  { id: 8, name: i18n.t('bilibili.partitions.kichiku') },
  { id: 3, name: i18n.t('bilibili.partitions.music') },
  { id: 129, name: i18n.t('bilibili.partitions.dance') },
  { id: 181, name: i18n.t('bilibili.partitions.film') },
  { id: 5, name: i18n.t('bilibili.partitions.entertainment') },
  { id: 36, name: i18n.t('bilibili.partitions.knowledge') },
  { id: 188, name: i18n.t('bilibili.partitions.tech') },
  { id: 202, name: i18n.t('bilibili.partitions.information') },
  { id: 76, name: i18n.t('bilibili.partitions.food') },
  { id: 138, name: i18n.t('bilibili.partitions.shortplay') },
  { id: 176, name: i18n.t('bilibili.partitions.auto') },
  { id: 155, name: i18n.t('bilibili.partitions.fashion') },
  { id: 235, name: i18n.t('bilibili.partitions.sports') },
  { id: 75, name: i18n.t('bilibili.partitions.animals') },
  { id: 21, name: i18n.t('bilibili.partitions.vlog') },
  { id: 162, name: i18n.t('bilibili.partitions.painting') },
  { id: 207, name: i18n.t('bilibili.partitions.ai') },
  { id: 208, name: i18n.t('bilibili.partitions.home') },
  { id: 209, name: i18n.t('bilibili.partitions.outdoor') },
  { id: 164, name: i18n.t('bilibili.partitions.fitness') },
  { id: 161, name: i18n.t('bilibili.partitions.handcraft') },
  { id: 165, name: i18n.t('bilibili.partitions.travel') },
  { id: 158, name: i18n.t('bilibili.partitions.rural') },
  { id: 159, name: i18n.t('bilibili.partitions.parenting') },
  { id: 160, name: i18n.t('bilibili.partitions.health') },
  { id: 163, name: i18n.t('bilibili.partitions.emotion') },
  { id: 22, name: i18n.t('bilibili.partitions.lifeInterest') },
  { id: 23, name: i18n.t('bilibili.partitions.lifeExperience') }
]
