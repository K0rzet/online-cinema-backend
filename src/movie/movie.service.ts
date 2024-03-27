import { Injectable, NotFoundException } from '@nestjs/common'
import { UpdateMovieDto } from './update-movie.dto'
import { InjectModel } from 'nestjs-typegoose'
import { MovieModel } from './movie.model'
import { ModelType } from '@typegoose/typegoose/lib/types'
import { Types } from 'mongoose'
import { TelegramService } from 'src/telegram/telegram.service'

@Injectable()
export class MovieService {
	constructor(
		@InjectModel(MovieModel) private readonly movieModel: ModelType<MovieModel>,
		private readonly telegramService: TelegramService
	) {}

	async bySlug(slug: string) {
		const slugDoc = await this.movieModel.findOne({ slug })
			.populate('actors genres')
			.exec()
		if (!slugDoc) throw new NotFoundException('Movie not found')
		return slugDoc
	}

	async byActor(actorId: Types.ObjectId) {
		const slugDoc = await this.movieModel.find({ actors: actorId }).exec()
		if (!slugDoc) throw new NotFoundException('Movies not found')
		return slugDoc
	}

	async byGenres(genreIds: Types.ObjectId[]) {
		return this.movieModel.find({ genres: { $in: genreIds } }).exec()
	}

	async getAll(searchTerm?: string) {
		let options: {}

		if (searchTerm)
			options = {
				$or: [
					{
						title: new RegExp(searchTerm, 'i'),
					},
				],
			}

		return this.movieModel.find(options)
			.select('-updatedAt -__v')
			.sort({ createdAt: 'desc' })
			.populate('actors genres')
			.exec()
	}

	async updateCountOpened(slug: string) {
		const updateDoc = await this.movieModel.findOneAndUpdate(
			{ slug },
			{
				$inc: { countOpened: 1 },
			},
			{
				new: true,
			}
		).exec()

		if (!updateDoc) throw new NotFoundException('Movie not found')

		return updateDoc
	}

	async getMostPopular() {
		return await this.movieModel.find({ countOpened: { $gt: 0 } })
			.sort({ countOpened: -1 })
			.populate('genres')
			.exec()
	}

	async updateRating(id: Types.ObjectId, newRating: number) {
		return this.movieModel.findByIdAndUpdate(
			id,
			{
				rating: newRating,
			},
			{
				new: true,
			}
		).exec()
	}

	// Admin place

	async byId(_id: string) {
		const movie = await this.movieModel.findById(_id)
		if (!movie) throw new NotFoundException('Movie not found')

		return movie
	}

	async create() {
		const defaultValue: UpdateMovieDto = {
			bigPoster: '',
			actors: [],
			genres: [],
			poster: '',
			title: '',
			videoUrl: '',
			slug: '',
		}

		const movie = await this.movieModel.create(defaultValue)
		return movie._id
	}

	async update(_id: string, dto: UpdateMovieDto) {
		if (!dto.isSendTelegram) {
			await this.sendNotification(dto)
			dto.isSendTelegram = true
		}

		const updateDoc = await this.movieModel.findByIdAndUpdate(_id, dto, {
			new: true,
		}).exec()

		if (!updateDoc) throw new NotFoundException('Movie not found')

		return updateDoc
	}

	async delete(_id: string) {
		const deleteDoc = await this.movieModel.findByIdAndDelete(_id).exec()
		if (!deleteDoc) throw new NotFoundException('Movie not found')

		return deleteDoc
	}

	async sendNotification(dto: UpdateMovieDto) {
		// if (process.env.NODE_ENV !== 'development')
		// 	await this.telegramService.sendPhoto(dto.poster)

		await this.telegramService.sendPhoto(
			'https://avatars.mds.yandex.net/i?id=25f7f9fe7381b621f530a9996da84d7c_l-9181172-images-thumbs&n=13'
		)

		const msg = `<b>${dto.title}</b>\n\n`

		await this.telegramService.sendMessage(msg, {
			reply_markup: {
				inline_keyboard: [
					[
						{
							url: 'https://yupikex.com/?watch=Леди%20Баг%20ФИЛЬМ',
							text: 'Посмотреть'

						},
					],
				],
			},
		})
	}
}
